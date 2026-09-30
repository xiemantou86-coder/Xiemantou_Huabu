'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const GameKvPrompt = require('../static/js/game-kv-prompt.js');

const DEFAULT_OUTPUT = `请生成一张繁体中文的游戏广告KV。

参考图规则：
- 图片1作为主角色参考，保持角色身份、脸部、发型、服装和核心特征一致。
- 图片2仅作为字体设计与排版风格参考，不复制其中的人物、背景、Logo或其他内容。

画面设计：
- 视觉风格：日系高品質動漫遊戲KV，主推角色插画，黑色五葉草風格，官方授權RPG海報風，細膩線條，頂級二次元立繪，電影感，遊戲宣傳主視覺。
- 构图：角色中心構圖，主体占据视觉核心，动态姿态，強對比、強光效、強主角感，背景层次清晰，并预留文案排版空间。
- 强调主角、动态姿态和强视觉焦点，背景层次清晰，整体具备商业广告冲击力。

文字排版：
- 主标题（必须准确呈现，不得改写）：「強者之戰現在開始」
- 副标题（必须准确呈现，字号明显小于主标题，不得改写）：「集結魔法騎士，征服四葉草王國！黑色五葉草官方授權 RPG。」
- 字体效果：醒目的奇幻游戏标题字，亮金色金属质感，立体描边、柔和投影与轻微发光，角落有闪耀反光，清晰可读。
- 排版位置：主标题位于画面下部中央，副标题紧随主标题下方，保持明确的视觉层级。
- 除上述指定文案外，不添加其他文字。

画质要求：
- 4K超清，精致的高精度画风，画面干净、平滑、统一，不要细碎噪点，不要高频纹理，不要脏污颗粒，商业广告级完成度。

限制：
- 成图不要添加游戏Logo、品牌标识、水印或角标。

负向提示词：
模糊，低清，噪点，颗粒感，脏污，灰蒙，雾感，低对比，过曝，过暗，色彩失真，多余物体，杂乱背景，畸形，变形，手部错误，乱码，错别字，重复文字`;

test('exports the browser and CommonJS API with stable option values', () => {
    assert.equal(globalThis.GameKvPrompt, GameKvPrompt);
    assert.equal(GameKvPrompt.DEFAULTS.promptKind, 'game-kv');
    assert.ok(GameKvPrompt.VISUAL_STYLE_OPTIONS.some(item => item.value === GameKvPrompt.DEFAULTS.visualStyle));
    assert.ok(GameKvPrompt.COMPOSITION_OPTIONS.some(item => item.value === GameKvPrompt.DEFAULTS.composition));
    assert.ok(GameKvPrompt.TITLE_EFFECT_OPTIONS.some(item => item.value === GameKvPrompt.DEFAULTS.titleEffect));
    assert.ok(GameKvPrompt.COPY_PLACEMENT_OPTIONS.some(item => item.value === GameKvPrompt.DEFAULTS.copyPlacement));
    assert.ok(GameKvPrompt.LANGUAGE_OPTIONS.some(item => item.value === GameKvPrompt.DEFAULTS.adLanguage));
});

test('ad language controls the generated KV language while keeping custom language data', () => {
    const korean = GameKvPrompt.compile({adLanguage:'ko'});
    assert.match(korean, /^请生成一张韩文的游戏广告KV。/);

    const customLanguage = {value:'custom-es', label:'西班牙语', prompt:'西班牙语', buttonText:'Descargar', custom:true};
    const normalized = GameKvPrompt.normalizeNode({adLanguage:'custom-es', adLanguageOptions:[customLanguage]});
    assert.equal(normalized.adLanguage, 'custom-es');
    assert.deepEqual(normalized.adLanguageOptions[0], customLanguage);
    assert.match(normalized.text, /^请生成一张西班牙语的游戏广告KV。/);
});

test('compiles the complete default prompt in a deterministic order', () => {
    assert.equal(GameKvPrompt.compile({}), DEFAULT_OUTPUT);
    const node = GameKvPrompt.createNodeData();
    assert.equal(node.type, 'gameKvPrompt');
    assert.equal(node.promptKind, 'game-kv');
    assert.equal(node.text, DEFAULT_OUTPUT);
});

test('feature switches remove complete optional sections without clearing stored values', () => {
    const input = {
        useFontReference:false,
        subtitleEnabled:false,
        qualityEnabled:false,
        noLogo:false,
        negativeEnabled:false
    };
    const output = GameKvPrompt.compile(input);
    const normalized = GameKvPrompt.normalizeNode(input);

    assert.doesNotMatch(output, /图片2/);
    assert.doesNotMatch(output, /副标题（必须准确呈现/);
    assert.doesNotMatch(output, /画质要求/);
    assert.doesNotMatch(output, /限制：/);
    assert.doesNotMatch(output, /负向提示词/);
    assert.equal(normalized.subtitle, GameKvPrompt.DEFAULTS.subtitle);
});

test('the ad copy switch removes the complete typography section while preserving copy fields', () => {
    const input = {
        copyEnabled:false,
        mainTitle:'保留的主标题',
        subtitle:'保留的副标题',
    };
    const normalized = GameKvPrompt.normalizeNode(input);
    const output = GameKvPrompt.compile(input);

    assert.equal(normalized.copyEnabled, false);
    assert.equal(normalized.mainTitle, '保留的主标题');
    assert.equal(normalized.subtitle, '保留的副标题');
    assert.doesNotMatch(output, /文字排版/);
    assert.doesNotMatch(output, /保留的主标题|保留的副标题/);
});

test('compiles user-defined style, composition, title effect, and placement options', () => {
    const custom = {
        visualStyle:[{value:'fresh-anime', label:'日系清新氛围', prompt:'日系清新氛围，柔和晨光，通透空气感，低饱和清亮色彩，轻盈而富有希望的游戏广告视觉'}],
        composition:[{value:'custom-diagonal', label:'能量斜切构图', prompt:'主角位于画面右侧三分之一，能量轨迹从左下向右上斜切，形成明确动势并预留标题空间'}],
        titleEffect:[{value:'custom-silver', label:'银白辉光', prompt:'银白色金属标题字，边缘冷光勾勒，细腻辉光，强对比且保持小字清晰可读'}],
        copyPlacement:[{value:'custom-bottom-left', label:'左下安全区', prompt:'主标题和副标题在画面左下安全区纵向排列，避开角色主体与关键动作'}]
    };
    const output = GameKvPrompt.compile({
        visualStyle:'fresh-anime',
        composition:'custom-diagonal',
        titleEffect:'custom-silver',
        copyPlacement:'custom-bottom-left'
    }, custom);

    assert.match(output, /日系清新氛围/);
    assert.match(output, /能量斜切构图/);
    assert.match(output, /银白色金属标题字/);
    assert.match(output, /左下安全区/);
});

test('compiles customizable reference image roles and instructions', () => {
    const output = GameKvPrompt.compile({
        image1Role:'服装与角色设定',
        image1Instruction:'保持服装结构和角色脸部特征一致',
        image2Role:'品牌字体气质',
        image2Instruction:'只借鉴字体轮廓与金属质感，不复制原图内容'
    });

    assert.match(output, /图片1作为服装与角色设定参考，保持服装结构和角色脸部特征一致。/);
    assert.match(output, /图片2仅作为品牌字体气质参考，只借鉴字体轮廓与金属质感，不复制原图内容。/);
});

test('base KV uses selected Logo and download button images with the current image numbers', () => {
    const references = [
        {id:'hero', sourceKey:'image-hero', imageNumber:1, prompt:'图片1作为主角色参考', enabled:true},
        {id:'logo', sourceKey:'image-logo', imageNumber:2, prompt:'图片2作为游戏Logo参考', enabled:true},
        {id:'button', sourceKey:'image-button', imageNumber:3, prompt:'图片3作为下载按钮参考', enabled:true}
    ];
    const input = {
        references, showLogo:true, logoReference:'image-logo',
        downloadButtonEnabled:true, downloadButtonCustom:true,
        downloadButtonReference:'image-button'
    };
    const output = GameKvPrompt.compile(input);
    assert.match(output, /图片2的游戏Logo，保持样式清晰完整/);
    assert.match(output, /图片3的按钮包裹文字：立即下載/);
    assert.equal((output.match(/图片2作为游戏Logo参考/g) || []).length, 0);
    assert.equal((output.match(/图片3作为下载按钮参考/g) || []).length, 0);

    const reordered = GameKvPrompt.compile({...input, references:[references[2], references[0], references[1]]
        .map((reference, index) => ({...reference, imageNumber:index + 1}))});
    assert.match(reordered, /图片3的游戏Logo/);
    assert.match(reordered, /图片1的按钮包裹文字/);

    const disabled = GameKvPrompt.compile({...input, showLogo:false, downloadButtonEnabled:false});
    assert.doesNotMatch(disabled, /图片2的游戏Logo|图片3的按钮包裹文字/);
    assert.match(disabled, /成图不要添加游戏Logo/);
});

test('disabling the no-logo rule does not keep suppressing logos through the default negative prompt', () => {
    const output = GameKvPrompt.compile({noLogo:false});
    const negativePrompt = output.split('负向提示词：\n')[1] || '';

    assert.doesNotMatch(output, /限制：\n- 成图不要添加游戏Logo/);
    assert.doesNotMatch(negativePrompt, /logo|品牌标识|水印|角标/i);
});

test('blank optional text does not create empty or dangling sections', () => {
    const output = GameKvPrompt.compile({
        mainTitle:' \r\n ',
        subtitle:'\t',
        qualityEnabled:false,
        extraPrompt:'\r\n',
        negativePrompt:''
    });

    assert.doesNotMatch(output, /文字排版/);
    assert.doesNotMatch(output, /画质要求/);
    assert.doesNotMatch(output, /额外要求/);
    assert.doesNotMatch(output, /负向提示词/);
    assert.doesNotMatch(output, /undefined|\[object Object\]/);
    assert.equal(output.endsWith('\n'), false);
});

test('normalizes legacy aliases and nested saved data', () => {
    const normalized = GameKvPrompt.normalizeNode({
        gameKv:{
            style:'暗黑史诗',
            layout:'ensemble',
            headline:'旧版主标题',
            subTitle:'旧版副标题',
            fontStyle:'水晶发光',
            placement:'top-center',
            useImage2:'false',
            showQuality:0,
            noLogo:false,
            negativeEnabled:'off'
        }
    });

    assert.equal(normalized.visualStyle, 'dark-epic');
    assert.equal(normalized.composition, 'ensemble');
    assert.equal(normalized.mainTitle, '旧版主标题');
    assert.equal(normalized.subtitle, '旧版副标题');
    assert.equal(normalized.titleEffect, 'crystal-glow');
    assert.equal(normalized.copyPlacement, 'top-center');
    assert.equal(normalized.useFontReference, false);
    assert.equal(normalized.qualityEnabled, false);
    assert.equal(normalized.noLogo, false);
    assert.equal(normalized.negativeEnabled, false);
    assert.equal(normalized.text, GameKvPrompt.compile(normalized));
});

test('keeps hostile-looking copy as inert plain prompt text instead of HTML-escaping it', () => {
    const hostile = '</textarea><img src=x onerror=alert(1)>&"';
    const output = GameKvPrompt.compile({mainTitle:hostile, subtitle:'', showSubtitle:false});

    assert.ok(output.includes(hostile));
    assert.doesNotMatch(output, /&lt;\/textarea&gt;/);
    assert.equal(typeof output, 'string');
});

test('compile and normalizeNode do not modify the caller input', () => {
    const input = {
        id:'kv-1',
        gameKv:{
            mainTitle:'  保留外部空白  ',
            extraPrompt:'第一行\r\n第二行'
        }
    };
    const before = JSON.parse(JSON.stringify(input));

    GameKvPrompt.normalizeNode(input);
    GameKvPrompt.compile(input);

    assert.deepEqual(input, before);
    assert.equal(GameKvPrompt.normalizeNode(input).extraPrompt, '第一行\n第二行');
});
