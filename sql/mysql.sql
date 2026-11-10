CREATE TABLE `jill_deid_preset` (
  `id` smallint(5) unsigned NOT NULL auto_increment COMMENT '編號',
  `title` varchar(100) NOT NULL default '' COMMENT '方案名稱',
  `description` varchar(255) NOT NULL default '' COMMENT '說明',
  `keep_strategy` enum('partial','hide_all','custom') NOT NULL default 'partial' COMMENT '保留策略',
  `marker_style` enum('code','label','blank') NOT NULL default 'code' COMMENT '遮罩標記樣式',
  `hyperlink_mode` enum('mask_pii_in_url','strip_link') NOT NULL default 'mask_pii_in_url' COMMENT '超連結處理方式',
  `custom_config` text NOT NULL COMMENT '自訂設定',
  `is_default` enum('1','0') NOT NULL COMMENT '是否為預設',
  `enable` enum('1','0') NOT NULL default '1' COMMENT '是否啟用',
  `sort` smallint(5) unsigned NOT NULL default '0' COMMENT '排序',
PRIMARY KEY  (`id`),
KEY (`sort`)
) ENGINE=MyISAM;

CREATE TABLE `jill_deid_rule` (
  `id` smallint(5) unsigned NOT NULL auto_increment COMMENT '編號',
  `title` varchar(100) NOT NULL default '' COMMENT '規則名稱',
  `category` varchar(10) NOT NULL default '' COMMENT '類別',
  `pattern` varchar(500) NOT NULL default '' COMMENT '比對規則（JS 正規表示式，旗標固定為 gu）',
  `apply_to_url` enum('1','0') NOT NULL default '1' COMMENT '套用於網址',
  `retention` varchar(255) NOT NULL default '{"mode":"none"}' COMMENT '保留設定',
  `sample_text` varchar(255) NOT NULL default '' COMMENT '範例文字',
  `description` varchar(255) NOT NULL default '' COMMENT '說明',
  `locked` enum('1','0') NOT NULL COMMENT '是否鎖定',
  `enable` enum('1','0') NOT NULL default '1' COMMENT '是否啟用',
  `sort` smallint(5) unsigned NOT NULL default '0' COMMENT '排序',
  `uid` mediumint(8) unsigned NOT NULL default '0' COMMENT '修改者',
  `updated_at` datetime NOT NULL on update current_timestamp() COMMENT '更新時間',
PRIMARY KEY  (`id`),
KEY (`uid`),
KEY (`sort`)
) ENGINE=MyISAM;

