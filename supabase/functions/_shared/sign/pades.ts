// Gio Sign: PAdES sealing. Adds an invisible signature field to a finished PDF,
// signs the bytes with a CAdES detached signature (PAdES baseline B) and adds
// an RFC 3161 timestamp over the signature (baseline T). Any change to the
// file afterwards breaks the seal. ASCII only.
//
// The signing key is behind a Signer, so the test key (held in Vault) and a
// cloud signing service later (key in their hardware) plug in the same way:
// the service only ever sees the hash of the signed attributes.

import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from "npm:pdf-lib@1.17.1";
import * as asn1js from "npm:asn1js@3.0.5";
import * as pkijs from "npm:pkijs@3.2.4";

pkijs.setEngine("gio", new pkijs.CryptoEngine({ name: "gio", crypto: globalThis.crypto }));

export interface Signer {
  /** The signing certificate first, then any intermediates (DER). */
  chain: Uint8Array[];
  /** RSASSA-PKCS1-v1_5 with SHA-256 over these bytes. */
  sign(data: Uint8Array): Promise<Uint8Array>;
  /** Shown in the reader's signature panel. */
  name: string;
}

/** Sends a TimeStampReq, returns the DER TimeStampResp. */
export type Tsa = (request: Uint8Array) => Promise<Uint8Array>;

const PLACEHOLDER_BYTES = 24_000; // CMS + certificate chain + timestamp token, with room
const BYTE_RANGE_PLACEHOLDER = "**********";

const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
  timeStampToken: "1.2.840.113549.1.9.16.2.14",
  sha256: "2.16.840.1.101.3.4.2.1",
  rsaEncryption: "1.2.840.113549.1.1.1",
};

const buf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf(data)));
}
export const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");

function pdfDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** Adds the signature field and dictionary with placeholders; returns the saved bytes. */
async function withPlaceholder(pdfBytes: Uint8Array, info: { name: string; reason: string; location: string; contact: string; at: Date }) {
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const ctx = pdf.context;
  const byteRange = PDFArray.withContext(ctx);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));

  const sig = ctx.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "ETSI.CAdES.detached",
    ByteRange: byteRange,
    Contents: PDFHexString.of("0".repeat(PLACEHOLDER_BYTES * 2)),
    Reason: PDFString.of(info.reason),
    M: PDFString.of(pdfDate(info.at)),
    Name: PDFString.of(info.name),
    Location: PDFString.of(info.location),
    ContactInfo: PDFString.of(info.contact),
  });
  const sigRef = ctx.register(sig);

  const page = pdf.getPages()[pdf.getPageCount() - 1];
  const widget = ctx.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    Rect: [0, 0, 0, 0],
    V: sigRef,
    T: PDFString.of("Gio Sign seal"),
    F: 132, // print + locked
    P: page.ref,
  });
  const widgetRef = ctx.register(widget);
  const annots = page.node.lookup(PDFName.of("Annots"));
  if (annots instanceof PDFArray) annots.push(widgetRef);
  else page.node.set(PDFName.of("Annots"), ctx.obj([widgetRef]));

  const acro = pdf.catalog.lookup(PDFName.of("AcroForm"));
  if (acro instanceof PDFDict) {
    const fields = acro.lookup(PDFName.of("Fields"));
    if (fields instanceof PDFArray) fields.push(widgetRef);
    else acro.set(PDFName.of("Fields"), ctx.obj([widgetRef]));
    acro.set(PDFName.of("SigFlags"), PDFNumber.of(3));
  } else {
    pdf.catalog.set(PDFName.of("AcroForm"), ctx.register(ctx.obj({ Fields: [widgetRef], SigFlags: 3 })));
  }
  return await pdf.save({ useObjectStreams: false, addDefaultPage: false });
}

function indexOf(hay: Uint8Array, needle: string, from = 0) {
  const n = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= hay.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer;
    return i;
  }
  return -1;
}

async function timestamp(signature: Uint8Array, tsa: Tsa): Promise<asn1js.Sequence> {
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  nonce[0] &= 0x7f;
  const req = new pkijs.TimeStampReq({
    version: 1,
    messageImprint: new pkijs.MessageImprint({
      hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256 }),
      hashedMessage: new asn1js.OctetString({ valueHex: buf(await sha256(signature)) }),
    }),
    nonce: new asn1js.Integer({ valueHex: buf(nonce) }),
    certReq: true,
  });
  const resBytes = await tsa(new Uint8Array(req.toSchema().toBER(false)));
  const asn = asn1js.fromBER(buf(resBytes));
  if (asn.offset === -1) throw new Error("tsa_bad_response");
  const res = new pkijs.TimeStampResp({ schema: asn.result });
  const status = res.status.status;
  if (status !== 0 && status !== 1) throw new Error(`tsa_refused_${status}`);
  if (!res.timeStampToken) throw new Error("tsa_no_token");
  return res.timeStampToken.toSchema() as asn1js.Sequence;
}

/** Builds the detached CAdES signature over `data`. */
async function cades(data: Uint8Array, signer: Signer, tsa: Tsa | null) {
  const certs = signer.chain.map((der) => new pkijs.Certificate({ schema: asn1js.fromBER(buf(der)).result }));
  const leaf = certs[0];
  const certHash = await sha256(signer.chain[0]);
  const digest = await sha256(data);

  // ESS signing-certificate-v2 (SHA-256 is the default algorithm, so it's omitted).
  const essCertIdV2 = new asn1js.Sequence({
    value: [
      new asn1js.Sequence({
        value: [
          new asn1js.Sequence({
            value: [
              new asn1js.OctetString({ valueHex: buf(certHash) }),
              new asn1js.Sequence({
                value: [
                  new asn1js.Sequence({ value: [new asn1js.Constructed({ idBlock: { tagClass: 3, tagNumber: 4 }, value: [leaf.issuer.toSchema()] })] }),
                  leaf.serialNumber,
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const signedAttrs = new pkijs.SignedAndUnsignedAttributes({
    type: 0,
    attributes: [
      new pkijs.Attribute({ type: OID.contentType, values: [new asn1js.ObjectIdentifier({ value: OID.data })] }),
      new pkijs.Attribute({ type: OID.messageDigest, values: [new asn1js.OctetString({ valueHex: buf(digest) })] }),
      new pkijs.Attribute({ type: OID.signingCertificateV2, values: [essCertIdV2] }),
    ],
  });

  // What gets signed is the DER of the attributes as a SET.
  const toSign = new Uint8Array(new asn1js.Set({ value: signedAttrs.attributes.map((a) => a.toSchema()) }).toBER(false));
  const signature = await signer.sign(toSign);

  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({ issuer: leaf.issuer, serialNumber: leaf.serialNumber }),
    digestAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256 }),
    signedAttrs,
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.rsaEncryption, algorithmParams: new asn1js.Null() }),
    signature: new asn1js.OctetString({ valueHex: buf(signature) }),
  });

  if (tsa) {
    const token = await timestamp(signature, tsa);
    signerInfo.unsignedAttrs = new pkijs.SignedAndUnsignedAttributes({
      type: 1,
      attributes: [new pkijs.Attribute({ type: OID.timeStampToken, values: [token] })],
    });
  }

  const signed = new pkijs.SignedData({
    version: 1,
    digestAlgorithms: [new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256 })],
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID.data }),
    certificates: certs,
    signerInfos: [signerInfo],
  });
  const ci = new pkijs.ContentInfo({ contentType: OID.signedData, content: signed.toSchema(true) });
  return new Uint8Array(ci.toSchema().toBER(false));
}

/** Seals a finished PDF. Returns the sealed bytes. */
export async function sealPdf(
  pdfBytes: Uint8Array,
  signer: Signer,
  tsa: Tsa | null,
  info: { reason: string; location: string; contact: string; at?: Date },
): Promise<Uint8Array> {
  const out = await withPlaceholder(pdfBytes, { name: signer.name, at: info.at ?? new Date(), ...info });

  const brPos = indexOf(out, `/ByteRange [ 0 /${BYTE_RANGE_PLACEHOLDER}`);
  if (brPos < 0) throw new Error("seal_no_byterange");
  const brEnd = indexOf(out, "]", brPos);
  const contentsPos = indexOf(out, "/Contents <" + "0".repeat(64), brPos > 2000 ? brPos - 2000 : 0);
  if (contentsPos < 0) throw new Error("seal_no_contents");
  const start = contentsPos + "/Contents ".length; // at '<'
  const end = indexOf(out, ">", start) + 1; // after '>'
  if (end - start !== PLACEHOLDER_BYTES * 2 + 2) throw new Error("seal_bad_contents");

  const range = [0, start, end, out.length - end];
  const original = new TextDecoder().decode(out.slice(brPos, brEnd + 1));
  let next = `/ByteRange [${range.join(" ")}]`;
  if (next.length > original.length) throw new Error("seal_byterange_too_long");
  next = next.slice(0, -1) + " ".repeat(original.length - next.length) + "]";
  out.set(new TextEncoder().encode(next), brPos);

  const data = new Uint8Array(range[1] + range[3]);
  data.set(out.subarray(0, range[1]), 0);
  data.set(out.subarray(range[2]), range[1]);

  const cms = await cades(data, signer, tsa);
  if (cms.length > PLACEHOLDER_BYTES) throw new Error("seal_signature_too_big");
  const h = hex(cms).padEnd(PLACEHOLDER_BYTES * 2, "0");
  out.set(new TextEncoder().encode(h), start + 1);
  return out;
}

/** An HTTP RFC 3161 timestamp authority. */
export function httpTsa(url: string): Tsa {
  return async (request) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/timestamp-query" }, body: request });
    if (!res.ok) throw new Error(`tsa_http_${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}

/* ------------------------------------------------------- test certificate */

const pemBody = (pem: string) => {
  const b = atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};
const pem = (label: string, der: Uint8Array) => {
  let s = "";
  for (const b of der) s += String.fromCharCode(b);
  return `-----BEGIN ${label}-----\n${btoa(s).replace(/(.{64})/g, "$1\n")}\n-----END ${label}-----\n`;
};

/**
 * A self-signed test certificate ("Gio Sign (test)"). Readers show the seal as
 * intact but the signer as unknown until the cloud signing service replaces it.
 */
export async function makeTestIdentity(): Promise<{ keyPem: string; certPem: string }> {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ valueHex: buf(crypto.getRandomValues(new Uint8Array(12)).map((b, i) => (i === 0 ? b & 0x7f : b))) });
  const name = (n: pkijs.RelativeDistinguishedNames) => {
    n.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: "2.5.4.6", value: new asn1js.PrintableString({ value: "US" }) }));
    n.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: "2.5.4.10", value: new asn1js.Utf8String({ value: "Virgilio Technologies LLC" }) }));
    n.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: "2.5.4.3", value: new asn1js.Utf8String({ value: "Gio Sign (test)" }) }));
  };
  name(cert.issuer);
  name(cert.subject);
  const now = new Date();
  cert.notBefore.value = new Date(now.getTime() - 86_400_000);
  cert.notAfter.value = new Date(now.getTime() + 5 * 365 * 86_400_000);
  cert.extensions = [
    new pkijs.Extension({
      extnID: "2.5.29.15", // key usage: digitalSignature + nonRepudiation
      critical: true,
      extnValue: new asn1js.BitString({ valueHex: new Uint8Array([0xc0]).buffer, unusedBits: 6 }).toBER(false),
    }),
  ];
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(keys.privateKey, "SHA-256");
  const certDer = new Uint8Array(cert.toSchema(true).toBER(false));
  const keyDer = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  return { keyPem: pem("PRIVATE KEY", keyDer), certPem: pem("CERTIFICATE", certDer) };
}

/** A Signer over a PEM key and certificate (the test identity). */
export async function pemSigner(keyPem: string, certPem: string, name: string): Promise<Signer> {
  const key = await crypto.subtle.importKey("pkcs8", buf(pemBody(keyPem)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return {
    chain: [pemBody(certPem)],
    name,
    sign: async (data) => new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, buf(data))),
  };
}
