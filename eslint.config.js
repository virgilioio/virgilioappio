import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // A component defined inside another component is a new component type
      // on every render: React remounts it, so inputs lose focus while typing
      // and open menus close. Use a plain function (renderX(...)) or move it
      // to module level.
      "no-restricted-syntax": [
        "error",
        {
          selector: ":function VariableDeclarator[id.name=/^[A-Z]/][init.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
          message: "Don't define a component inside another component: it remounts on every render. Use a plain render function or move it to module level.",
        },
        {
          selector: ":function FunctionDeclaration[id.name=/^[A-Z]/]",
          message: "Don't define a component inside another component: it remounts on every render. Use a plain render function or move it to module level.",
        },
      ],
    },
  }
);
