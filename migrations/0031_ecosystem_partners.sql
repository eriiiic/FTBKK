-- Partners of La French Tech Bangkok: any directory listing can be a partner, with its own type,
-- an order and a "show on Home" switch. Replaces the partners list of Website pages > Home and the
-- "Institutional partner" badge.
ALTER TABLE `organisations` ADD `partner_type` text;
--> statement-breakpoint
ALTER TABLE `organisations` ADD `partner_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `organisations` ADD `partner_home` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Listings with the old badge become institutional partners (not on Home unless listed below).
UPDATE `organisations` SET `partner_type` = 'institutional'
WHERE EXISTS (SELECT 1 FROM json_each(`organisations`.`badges`) WHERE value = 'institutional');
--> statement-breakpoint
UPDATE `organisations`
SET `badges` = (SELECT json_group_array(value) FROM json_each(`organisations`.`badges`) WHERE value <> 'institutional')
WHERE EXISTS (SELECT 1 FROM json_each(`organisations`.`badges`) WHERE value = 'institutional');
--> statement-breakpoint
-- The Home strip: the list saved in Website pages > Home, else the built-in one. A listing matches
-- a partner by name or by website host, like the old logo lookup did.
WITH saved AS (
  SELECT json_extract(j.value, '$.title') AS title, coalesce(json_extract(j.value, '$.link'), '') AS link, j.key AS pos
  FROM `settings` s, json_each(s.value) j
  WHERE s.key = 'homePartners' AND json_valid(s.value)
),
builtin(title, link, pos) AS (
  VALUES
    ('Business France', 'https://www.businessfrance.fr/', 0),
    ('Franco-Thai Chamber of Commerce', 'https://www.francothaicc.com/', 1),
    ('Embassy of France in Thailand', 'https://th.diplomatie.gouv.fr/', 2),
    ('La French Tech', 'https://lafrenchtech.gouv.fr/', 3),
    ('Bpifrance', 'https://www.bpifrance.fr/', 4)
),
list AS (
  SELECT * FROM saved
  UNION ALL
  SELECT * FROM builtin WHERE NOT EXISTS (SELECT 1 FROM saved)
),
norm AS (
  SELECT lower(trim(title)) AS name, pos,
    replace(replace(replace(lower(link), 'https://', ''), 'http://', ''), 'www.', '') AS h
  FROM list
),
partners AS (
  SELECT name, pos, CASE WHEN instr(h, '/') > 0 THEN substr(h, 1, instr(h, '/') - 1) ELSE h END AS host
  FROM norm
),
orgs AS (
  SELECT id, lower(trim(name)) AS name,
    replace(replace(replace(lower(coalesce(website, '')), 'https://', ''), 'http://', ''), 'www.', '') AS h
  FROM `organisations`
  WHERE status = 'published'
),
org_hosts AS (
  SELECT id, name, CASE WHEN instr(h, '/') > 0 THEN substr(h, 1, instr(h, '/') - 1) ELSE h END AS host
  FROM orgs
),
matches AS (
  SELECT o.id, min(p.pos) AS pos
  FROM org_hosts o JOIN partners p ON o.name = p.name OR (p.host <> '' AND o.host = p.host)
  GROUP BY o.id
)
UPDATE `organisations`
SET `partner_type` = coalesce(`partner_type`, 'institutional'),
  `partner_home` = 1,
  `partner_order` = (SELECT pos + 1 FROM matches WHERE matches.id = `organisations`.`id`)
WHERE id IN (SELECT id FROM matches);
