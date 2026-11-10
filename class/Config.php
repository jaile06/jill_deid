<?php

declare(strict_types=1);

namespace XoopsModules\Jill_deid;

/** 組前台設定 JSON（spec §7），由 index.php 輸出到樣板的 <script type="application/json"> */
class Config
{
    public static function build(): array
    {
        global $xoopsModuleConfig;
        xoops_loadLanguage('modinfo', 'jill_deid');

        $orgRules = [];
        foreach (Tools::rows(Rule::TABLE, "WHERE `enable` = '1'") as $r) {
            $orgRules[] = [
                'id'         => "org-{$r['id']}",
                'name'       => $r['title'],
                'category'   => $r['category'],
                'regex'      => $r['pattern'],
                'applyToUrl' => '1' === $r['apply_to_url'],
                'retention'  => json_decode($r['retention'], true) ?: ['mode' => 'none'],
                'example'    => $r['sample_text'],
                'locked'     => '1' === $r['locked'],
            ];
        }

        // 萬一殘留多筆 is_default，排序最前者才算（spec §3.2）
        $presets    = [];
        $hasDefault = false;
        foreach (Tools::rows(Preset::TABLE, "WHERE `enable` = '1'") as $p) {
            $isDefault  = !$hasDefault && '1' === $p['is_default'];
            $hasDefault = $hasDefault || $isDefault;
            $presets[]  = [
                'id'            => (int) $p['id'],
                'title'         => $p['title'],
                'description'   => $p['description'],
                'keepStrategy'  => $p['keep_strategy'],
                'markerStyle'   => $p['marker_style'],
                'hyperlinkMode' => $p['hyperlink_mode'],
                'custom'        => json_decode($p['custom_config']) ?: new \stdClass(),
                'isDefault'     => $isDefault,
            ];
        }

        // 模組設定尚未更新時（新增設定項後未按「更新模組」）退回語言檔的預設值
        $lines = static fn (string $text): array => array_values(array_filter(array_map('trim', preg_split('/\R/', $text))));
        $labels = [];
        foreach ($lines((string) ($xoopsModuleConfig['column_labels'] ?? _MI_JILLDEID_COLUMN_LABELS_DEFAULT)) as $line) {
            [$label, $category] = array_map('trim', explode('=', $line, 2)) + [1 => ''];
            if ('' !== $label && '' !== $category) {
                $labels[$label] = $category;
            }
        }

        return [
            'version'          => 1,
            'assetsBase'       => XOOPS_URL . '/modules/jill_deid/assets/',
            'orgRules'         => $orgRules,
            'presets'          => $presets,
            'urlPersonalHosts' => $lines((string) ($xoopsModuleConfig['url_personal_hosts'] ?? '')),
            'columnLabels'     => $labels ?: new \stdClass(),
        ];
    }

    public static function toJson(): string
    {
        return json_encode(self::build(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
