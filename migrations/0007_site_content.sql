-- Home and About page content from the original site and the French Tech usage charter (Oct 2026).
-- "You can join us" cards take the original wording, with links, unless someone already edited them.
UPDATE settings SET value = '[{"title":"An individual","text":"Join our WhatsApp group and our free English-speaking events.","link":"/events"},{"title":"A startup","text":"You want your startup to be a certified French Tech member? It is free.","link":"/ecosystem/submit"},{"title":"A business partner","text":"You represent a corporation, a VC fund or an institution and you want to get in touch? Contact us to learn more.","link":"/about#contact"}]'
  WHERE key = 'joinPaths' AND value = '[{"title":"Individuals","text":"Come to our monthly French Tech Connect and Talks, join the WhatsApp group and meet the community."},{"title":"Startups","text":"Get listed in the ecosystem directory and apply for the free French Tech Bangkok membership."},{"title":"Business partners","text":"Support the community, host an event or share your expertise with founders."}]';
INSERT OR IGNORE INTO settings (key, value) VALUES ('joinPaths', '[{"title":"An individual","text":"Join our WhatsApp group and our free English-speaking events.","link":"/events"},{"title":"A startup","text":"You want your startup to be a certified French Tech member? It is free.","link":"/ecosystem/submit"},{"title":"A business partner","text":"You represent a corporation, a VC fund or an institution and you want to get in touch? Contact us to learn more.","link":"/about#contact"}]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('communityText', '"## An official French Tech Community\n\nLa French Tech Bangkok is one of the French Tech Communities labelled by the Mission French Tech, the French State''s team behind La French Tech. The label lasts three years: ours was [renewed for 2026–2028](/blog/la-french-tech-bangkok-officially-relabelled-for-2026-2028).\n\n### Using our name and logo\n\nThe French Tech brand belongs to the French State and can''t be used to promote a product or a service. Partners, members and institutions can use the La French Tech Bangkok logo with our agreement: [write to us](/about#contact) and we''ll send the official files. Please use the logo as it is, without changing its colours, layout or lettering."');

-- Job titles of the board and institutional partners, as on the original About page.
-- Only fills titles that are still empty.
UPDATE people SET title = 'Founder & Managing Director' WHERE name = 'Olivier Dombey' AND (title IS NULL OR title = '');
UPDATE people SET title = 'Director, B2C Connected Partners' WHERE name = 'Mathieu Verhaeghe' AND (title IS NULL OR title = '');
UPDATE people SET title = 'Digital Communications Executive' WHERE name = 'Seren Gaultier' AND (title IS NULL OR title = '');
UPDATE people SET title = 'People and Team Lead' WHERE name = 'Emma Longieras' AND (title IS NULL OR title = '');
UPDATE people SET title = 'CEO' WHERE name = 'Julien Gadea' AND (title IS NULL OR title = '');
UPDATE people SET title = 'GM' WHERE name = 'Malika Ait El Mouden' AND (title IS NULL OR title = '');
UPDATE people SET title = 'Co-founder' WHERE name = 'Vincent Birot' AND (title IS NULL OR title = '');
UPDATE people SET title = 'CDO' WHERE name = 'Laetitia Hoquetis' AND (title IS NULL OR title = '');
UPDATE people SET title = 'Founder' WHERE name = 'Maxime Carpentier' AND (title IS NULL OR title = '');
UPDATE people SET title = 'CEO' WHERE name = 'Laetitia Lim' AND (title IS NULL OR title = '');
UPDATE people SET title = 'Executive Director' WHERE name = 'Séverine Clément Derville' AND (title IS NULL OR title = '');
UPDATE people SET title = 'Economic Attaché' WHERE name = 'Julien Hohl' AND (title IS NULL OR title = '');
UPDATE people SET title = 'Head of Tech and Services' WHERE name = 'Phutachart Chaiwatana' AND (title IS NULL OR title = '');

-- The capture cut off the last letter of this venue name.
UPDATE events SET venue = 'CALM Bangkok - Grill, Garden & Guinguette' WHERE venue = 'CALM Bangkok - Grill, Garden & Guinguett';

-- One blog category under two spellings: keep the slug the posts and old links use, fix its name,
-- and drop the empty duplicate.
UPDATE categories SET name = 'Studies & Resources' WHERE slug = 'studies-and-ressources';
DELETE FROM categories WHERE slug = 'studies-and-resources' AND id NOT IN (SELECT category_id FROM post_categories);
