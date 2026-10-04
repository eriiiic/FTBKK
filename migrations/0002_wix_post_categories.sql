-- Real blog categories, read from the Wix dashboard on 2026-10-04 (the first capture put every
-- post in every category). Posts or categories that don't exist are skipped.

DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'french-tech-2026-an-ecosystem-ready-to-compete-on-the-global-stage');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'french-tech-2026-an-ecosystem-ready-to-compete-on-the-global-stage' AND c.name = 'Ecosystem News';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'french-tech-2026-an-ecosystem-ready-to-compete-on-the-global-stage' AND c.name = 'Tech Insights';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'french-tech-2026-an-ecosystem-ready-to-compete-on-the-global-stage' AND c.name = 'Studies & ressources';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'thailand-tech-pulse-q3-2026-thailand-s-tech-economy-enters-a-new-phase');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'thailand-tech-pulse-q3-2026-thailand-s-tech-economy-enters-a-new-phase' AND c.name = 'Ecosystem News';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'thailand-tech-pulse-q3-2026-thailand-s-tech-economy-enters-a-new-phase' AND c.name = 'Tech Insights';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'thailand-tech-pulse-q3-2026-thailand-s-tech-economy-enters-a-new-phase' AND c.name = 'Studies & ressources';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'la-french-tech-bangkok-releases-thailand-tech-pulse-q2-2026-edition');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-releases-thailand-tech-pulse-q2-2026-edition' AND c.name = 'Ecosystem News';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-releases-thailand-tech-pulse-q2-2026-edition' AND c.name = 'Tech Insights';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-releases-thailand-tech-pulse-q2-2026-edition' AND c.name = 'Studies & ressources';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'la-french-tech-bangkok-launches-its-first-thailand-tech-pulse-for-q1-2026');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-launches-its-first-thailand-tech-pulse-for-q1-2026' AND c.name = 'Ecosystem News';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-launches-its-first-thailand-tech-pulse-for-q1-2026' AND c.name = 'Tech Insights';
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-launches-its-first-thailand-tech-pulse-for-q1-2026' AND c.name = 'Studies & ressources';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'how-to-start-a-business-in-thailand-a-practical-guide-for-foreign-founders-part-1-4');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'how-to-start-a-business-in-thailand-a-practical-guide-for-foreign-founders-part-1-4' AND c.name = 'Founder Guides';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'how-to-start-a-business-in-thailand-a-practical-guide-for-foreign-founders-part-2-4');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'how-to-start-a-business-in-thailand-a-practical-guide-for-foreign-founders-part-2-4' AND c.name = 'Founder Guides';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'we-ran-ai-100-offline-on-our-laptops-learnings');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'we-ran-ai-100-offline-on-our-laptops-learnings' AND c.name = 'Tech Insights';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'ai-is-changing-cybersecurity-faster-than-most-companies-realize');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'ai-is-changing-cybersecurity-faster-than-most-companies-realize' AND c.name = 'Tech Insights';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'why-bangkok-is-attracting-more-and-more-french-startups');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'why-bangkok-is-attracting-more-and-more-french-startups' AND c.name = 'Ecosystem News';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'la-french-tech-bangkok-officially-relabelled-for-2026-2028');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-officially-relabelled-for-2026-2028' AND c.name = 'Ecosystem News';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'la-french-tech-bangkok-is-looking-for-its-next-board-members');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-is-looking-for-its-next-board-members' AND c.name = 'Events & Community';
DELETE FROM post_categories WHERE post_id IN (SELECT id FROM posts WHERE slug = 'la-french-tech-bangkok-x-common-ground-thailand-a-new-home-for-french-tech-talks-2026');
INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = 'la-french-tech-bangkok-x-common-ground-thailand-a-new-home-for-french-tech-talks-2026' AND c.name = 'Events & Community';
