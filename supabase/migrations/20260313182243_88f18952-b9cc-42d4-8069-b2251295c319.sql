
DELETE FROM job_candidate_associations 
WHERE id IN (
  '30e93eed-58f1-4e5e-99dc-98ca080f1b1e',
  'c7af2186-5fb5-4956-a2ab-187a157e77a8',
  'b42e61d3-9505-488d-9624-2840cd9eecdc',
  '711b7677-f96e-4411-892f-4df5a3ebad44',
  '821feea8-5bba-4bed-837f-ec5659724687'
);

DELETE FROM candidates 
WHERE id IN (
  '73a7237f-1712-45ab-a47f-89b43b991801',
  'ec6d722e-f53a-4444-b671-50ff82682491',
  'b9ad583a-8524-40ef-9593-b277ffe99c72',
  'd910e625-c58b-4130-8a84-1dee2d010f89',
  '03927820-4c0b-4d9f-a10c-55a68d711471'
);
