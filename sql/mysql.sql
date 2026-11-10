CREATE TABLE `jill_deid_rule` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL DEFAULT '',
  `category` varchar(10) NOT NULL DEFAULT '',
  `pattern` varchar(500) NOT NULL DEFAULT '' COMMENT 'JS RegExp source, flags fixed to gu',
  `apply_to_url` enum('1','0') NOT NULL DEFAULT '1',
  `retention` varchar(255) NOT NULL DEFAULT '{"mode":"none"}',
  `sample_text` varchar(255) NOT NULL DEFAULT '',
  `description` varchar(255) NOT NULL DEFAULT '',
  `locked` enum('1','0') NOT NULL DEFAULT '0',
  `enable` enum('1','0') NOT NULL DEFAULT '1',
  `sort` smallint unsigned NOT NULL DEFAULT 0,
  `uid` mediumint unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_enable_sort` (`enable`, `sort`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

CREATE TABLE `jill_deid_preset` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL DEFAULT '',
  `description` varchar(255) NOT NULL DEFAULT '',
  `keep_strategy` enum('partial','hide_all','custom') NOT NULL DEFAULT 'partial',
  `marker_style` enum('code','label','blank') NOT NULL DEFAULT 'code',
  `hyperlink_mode` enum('mask_pii_in_url','strip_link') NOT NULL DEFAULT 'mask_pii_in_url',
  `custom_config` text NOT NULL,
  `is_default` enum('1','0') NOT NULL DEFAULT '0',
  `enable` enum('1','0') NOT NULL DEFAULT '1',
  `sort` smallint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
