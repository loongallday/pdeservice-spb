-- Remove announcements management menu (using existing pages instead)

DELETE FROM main_features WHERE id = 'menu_announcements_manage';
