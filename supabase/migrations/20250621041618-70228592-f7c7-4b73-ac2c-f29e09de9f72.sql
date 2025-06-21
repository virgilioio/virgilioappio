
-- Insert the required advertising banner settings into platform_settings table
INSERT INTO platform_settings (setting_key, setting_value, setting_type, display_name, description) VALUES
('ad_banner_enabled', 'false', 'boolean', 'Enable Advertising Banner', 'Show the internal advertising banner to Platform Admins and Workspace Owners'),
('ad_banner_title', '', 'text', 'Banner Title', 'The title text for the advertising banner'),
('ad_banner_body', '', 'textarea', 'Banner Content', 'The main content/message for the advertising banner'),
('ad_banner_button_text', '', 'text', 'Button Text', 'The text displayed on the banner button (optional)'),
('ad_banner_button_url', '', 'url', 'Button URL', 'The URL the button links to when clicked (optional)');
