-- Home community block and About "You can join us": adds a 4th way in, "An enterprise", after
-- the existing cards. Skipped when the list is empty or already has an enterprise card (the
-- team edits the cards in Website > Home page > You can join us).
UPDATE settings
SET value = json_insert(
  value,
  '$[#]',
  json_object(
    'title', 'An enterprise',
    'text', 'Your company works between France and Thailand? List it in the ecosystem directory and meet the community, for free.',
    'link', '/join#directory'
  )
)
WHERE key = 'joinPaths'
  AND json_valid(value)
  AND json_array_length(value) BETWEEN 1 AND 5
  AND lower(value) NOT LIKE '%enterprise%';
