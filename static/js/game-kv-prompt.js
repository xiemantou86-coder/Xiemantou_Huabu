(function(root, factory){
    'use strict';
    const api = factory();
    if(typeof module === 'object' && module.exports) module.exports = api;
    if(root && typeof root === 'object') root.GameKvPrompt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
    'use strict';

    const freezeOptions = items => Object.freeze(items.map(item => Object.freeze({...item})));

    const VISUAL_STYLE_OPTIONS = freezeOptions([
        {
            value:'anime-fantasy',
            label:'日系热血魔法',
            prompt:'日系高品質動漫遊戲KV，主推角色插画，黑色五葉草風格，官方授權RPG海報風，細膩線條，頂級二次元立繪，電影感，遊戲宣傳主視覺'
        },
        {
            value:'dark-epic',
            label:'暗黑史诗',
            prompt:'暗黑史诗游戏广告KV，写实与二次元融合，强烈明暗反差，厚重材质，压迫感与英雄气质并存'
        },
        {
            value:'cute-adventure',
            label:'萌系冒险',
            prompt:'明亮萌系二次元游戏广告KV，轻快冒险氛围，清透色彩，精致角色插画，富有亲和力与活力'
        },
        {
            value:'sci-fi-action',
            label:'科幻动作',
            prompt:'未来科幻动作游戏广告KV，精密机械细节，霓虹能量光效，高速度感，电影级战斗氛围'
        }
    ]);

    const COMPOSITION_OPTIONS = freezeOptions([
        {
            value:'hero-center',
            label:'主角居中',
            prompt:'角色中心構圖，主体占据视觉核心，动态姿态，強對比、強光效、強主角感，背景层次清晰，并预留文案排版空间'
        },
        {
            value:'diagonal-action',
            label:'对角线动势',
            prompt:'以对角线组织角色动作与能量轨迹，形成强烈速度感和冲击力，同时保持主角面部清晰'
        },
        {
            value:'ensemble',
            label:'群像集结',
            prompt:'核心主角位于前景中心，队伍成员在后方分层展开，人物关系清晰，形成史诗群像与集结感'
        },
        {
            value:'cinematic-wide',
            label:'电影宽景',
            prompt:'电影感宽景构图，角色与环境形成清晰尺度对比，前中后景完整，视觉焦点明确并留有文案区域'
        }
    ]);

    const TITLE_EFFECT_OPTIONS = freezeOptions([
        {
            value:'gold-metal',
            label:'金色金属',
            prompt:'醒目的奇幻游戏标题字，亮金色金属质感，立体描边、柔和投影与轻微发光，角落有闪耀反光，清晰可读'
        },
        {
            value:'crystal-glow',
            label:'水晶发光',
            prompt:'通透水晶质感标题字，冷色内发光、细致高光边缘与轻微空间投影，清晰可读'
        },
        {
            value:'flame-impact',
            label:'火焰冲击',
            prompt:'高冲击力战斗标题字，红金火焰能量、粗壮描边和清晰立体层次，保持文字准确可读'
        },
        {
            value:'clean-white',
            label:'简洁白字',
            prompt:'简洁有力的白色商业标题字，细描边与克制投影，高对比、清晰可读，不使用复杂纹理'
        }
    ]);

    const COPY_PLACEMENT_OPTIONS = freezeOptions([
        {
            value:'bottom-center',
            label:'下方居中',
            prompt:'主标题位于画面下部中央，副标题紧随主标题下方，保持明确的视觉层级',
            singlePrompt:'主标题位于画面下部中央，保持明确的视觉层级'
        },
        {
            value:'top-center',
            label:'上方居中',
            prompt:'主标题位于画面上部中央，副标题紧随主标题下方，不遮挡角色面部和关键动作',
            singlePrompt:'主标题位于画面上部中央，不遮挡角色面部和关键动作'
        },
        {
            value:'left-stack',
            label:'左侧纵排',
            prompt:'文案在画面左侧纵向编排，主标题醒目，副标题紧随其下，并与右侧角色形成平衡',
            singlePrompt:'主标题在画面左侧醒目呈现，并与右侧角色形成平衡'
        },
        {
            value:'right-stack',
            label:'右侧纵排',
            prompt:'文案在画面右侧纵向编排，主标题醒目，副标题紧随其下，并与左侧角色形成平衡',
            singlePrompt:'主标题在画面右侧醒目呈现，并与左侧角色形成平衡'
        }
    ]);

    const REFERENCE_OPTIONS = freezeOptions([
        {
            value:'hero-character',
            label:'主角色',
            prompt:'图片1作为主角色参考，保持角色身份、脸部、发型、服装和核心特征一致'
        },
        {
            value:'font-design',
            label:'字体设计与排版风格',
            prompt:'图片2仅作为字体设计与排版风格参考，不复制其中的人物、背景、Logo或其他内容'
        }
    ]);
    const LANGUAGE_OPTIONS = freezeOptions([
        {value:'zh-hant', label:'繁体中文', prompt:'繁体中文', buttonText:'立即下載'},
        {value:'ko', label:'韩文', prompt:'韩文', buttonText:'지금 다운로드'},
        {value:'th', label:'泰文', prompt:'泰文', buttonText:'ดาวน์โหลดเลย'},
        {value:'ru', label:'俄文', prompt:'俄文', buttonText:'Скачать'},
        {value:'vi', label:'越南语', prompt:'越南语', buttonText:'Tải ngay'},
        {value:'id', label:'印尼语', prompt:'印尼语', buttonText:'Download'},
        {value:'en', label:'英文', prompt:'英文', buttonText:'Download'}
    ]);
    const DEFAULT_REFERENCES = Object.freeze(REFERENCE_OPTIONS.map(option => ({...option, enabled:true})));

    const BASE_DEFAULTS = Object.freeze({
        type:'gameKvPrompt',
        promptKind:'game-kv',
        kvVersion:1,
        visualStyle:'anime-fantasy',
        composition:'hero-center',
        copyEnabled:true,
        titleEffect:'gold-metal',
        copyPlacement:'bottom-center',
        mainTitle:'強者之戰現在開始',
        subtitleEnabled:true,
        subtitle:'集結魔法騎士，征服四葉草王國！黑色五葉草官方授權 RPG。',
        image1Role:'主角色',
        image1Instruction:'保持角色身份、脸部、发型、服装和核心特征一致',
        image2Role:'字体设计与排版风格',
        image2Instruction:'不复制其中的人物、背景、Logo或其他内容',
        references:DEFAULT_REFERENCES,
        useFontReference:true,
        showLogo:false,
        logoReference:'',
        downloadButtonEnabled:false,
        downloadButtonCustom:false,
        downloadButtonReference:'',
        // Keep the legacy noLogo switch separate from showLogo. Older saved
        // canvases used noLogo to disable the entire logo restriction section.
        noLogo:true,
        qualityEnabled:true,
        negativeEnabled:true,
        adLanguage:'zh-hant',
        adLanguageOptions:LANGUAGE_OPTIONS,
        extraPrompt:'',
        negativePrompt:'模糊，低清，噪点，颗粒感，脏污，灰蒙，雾感，低对比，过曝，过暗，色彩失真，多余物体，杂乱背景，畸形，变形，手部错误，乱码，错别字，重复文字',
    });
    const QUALITY_PROMPT = '4K超清，精致的高精度画风，画面干净、平滑、统一，不要细碎噪点，不要高频纹理，不要脏污颗粒，商业广告级完成度';

    const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

    function mergeInput(input){
        const root = isRecord(input) ? input : {};
        const merged = {};
        [root.config, root.kv, root.gameKv, root].forEach(source => {
            if(!isRecord(source)) return;
            Object.keys(source).forEach(key => {
                if(source[key] !== undefined) merged[key] = source[key];
            });
        });
        return merged;
    }

    function firstValue(source, keys){
        for(const key of keys){
            if(hasOwn(source, key)) return source[key];
        }
        return undefined;
    }

    function textValue(source, keys, fallback){
        const value = firstValue(source, keys);
        if(value === undefined) return fallback;
        if(value === null) return '';
        if(typeof value !== 'string' && typeof value !== 'number') return fallback;
        return String(value).replace(/\r\n?/g, '\n').trim();
    }

    function booleanValue(source, keys, fallback){
        const value = firstValue(source, keys);
        if(value === undefined || value === null || value === '') return fallback;
        if(typeof value === 'boolean') return value;
        if(typeof value === 'number') return value !== 0;
        if(typeof value === 'string'){
            const normalized = value.trim().toLowerCase();
            if(['true','1','yes','on'].includes(normalized)) return true;
            if(['false','0','no','off'].includes(normalized)) return false;
        }
        return fallback;
    }

    function optionList(candidate, fallback){
        if(!Array.isArray(candidate)) return fallback;
        const seen = new Set();
        const result = [];
        candidate.forEach(item => {
            if(!item || typeof item !== 'object') return;
            const value = String(item.value ?? item.id ?? '').trim();
            const label = String(item.label ?? item.name ?? value).trim();
            const prompt = String(item.prompt ?? item.text ?? '').trim();
            if(!value || !label || !prompt || seen.has(value)) return;
            seen.add(value);
            const isCustom = item.custom === true || !fallback.some(base => String(base?.value || '') === value);
            result.push({...item, value, label, prompt, custom:isCustom});
        });
        return result.length ? result : fallback;
    }

    function optionsFor(catalog, key, fallback){
        return optionList(catalog?.[key], fallback);
    }

    function choiceValue(source, keys, fallback, options){
        const raw = textValue(source, keys, fallback);
        if(!raw) return fallback;
        const option = options.find(item => item.value === raw || item.label === raw || item.prompt === raw);
        return option ? option.value : raw;
    }

    function normalizeReferenceItem(item, index, options){
        const fallback = options[index] || null;
        if(typeof item === 'string' || typeof item === 'number'){
            const value = String(item).trim();
            const option = options.find(candidate => candidate.value === value || candidate.label === value || candidate.prompt === value) || fallback;
            if(!option) return null;
            return {id:String(option.value), value:String(option.value), label:String(option.label), prompt:String(option.prompt), enabled:true};
        }
        if(!isRecord(item)) return null;
        const value = String(item.value ?? item.id ?? fallback?.value ?? `reference-${index + 1}`).trim();
        const option = options.find(candidate => candidate.value === value || candidate.label === value || candidate.prompt === value) || fallback;
        const label = textValue(item, ['label','name','title'], option?.label || `参考图${index + 1}`) || `参考图${index + 1}`;
        const prompt = textValue(item, ['prompt','instruction','text','rule','description'], option?.prompt || '');
        const enabled = booleanValue(item, ['enabled','active','use'], true);
        return {...item, id:value || `reference-${index + 1}`, value:value || `reference-${index + 1}`, label, prompt, enabled};
    }

    function normalizeReferences(source, catalog={}){
        const options = optionsFor(catalog, 'references', REFERENCE_OPTIONS);
        const raw = firstValue(source, ['references','referenceRules','referenceImages']);
        if(Array.isArray(raw)) return raw.map((item, index) => normalizeReferenceItem(item, index, options)).filter(Boolean);
        const image1Role = textValue(source, ['image1Role','imageOneRole','reference1Role','image1Label','reference1Label'], BASE_DEFAULTS.image1Role);
        const image1Instruction = textValue(source, ['image1Instruction','imageOneInstruction','reference1Instruction','image1Prompt','reference1Prompt'], BASE_DEFAULTS.image1Instruction);
        const image2Role = textValue(source, ['image2Role','imageTwoRole','reference2Role','image2Label','reference2Label'], BASE_DEFAULTS.image2Role);
        const image2Instruction = textValue(source, ['image2Instruction','imageTwoInstruction','reference2Instruction','image2Prompt','reference2Prompt'], BASE_DEFAULTS.image2Instruction);
        return [
            {id:'reference-1', value:'reference-1', label:image1Role || BASE_DEFAULTS.image1Role, prompt:referenceRule(1, image1Role, image1Instruction, BASE_DEFAULTS.image1Role, BASE_DEFAULTS.image1Instruction), enabled:true},
            {id:'reference-2', value:'reference-2', label:image2Role || BASE_DEFAULTS.image2Role, prompt:referenceRule(2, image2Role, image2Instruction, BASE_DEFAULTS.image2Role, BASE_DEFAULTS.image2Instruction), enabled:booleanValue(source, ['useFontReference','useImage2Typography','useImage2','includeImage2'], BASE_DEFAULTS.useFontReference)}
        ];
    }

    function normalizeLanguages(candidate){
        const raw = Array.isArray(candidate) && candidate.length ? candidate : LANGUAGE_OPTIONS;
        const seen = new Set();
        const result = raw.map((item, index) => {
            const base = LANGUAGE_OPTIONS[index] || {};
            const value = String(item?.value || item?.id || base.value || `custom-${index + 1}`).trim();
            if(!value || seen.has(value)) return null;
            seen.add(value);
            return {
                value,
                label:String(item?.label || item?.name || base.label || value).trim(),
                prompt:String(item?.prompt || item?.text || item?.label || base.prompt || value).trim(),
                buttonText:String(item?.buttonText ?? item?.downloadText ?? base.buttonText ?? 'Download').trim(),
                custom:Boolean(item?.custom || !LANGUAGE_OPTIONS.some(option => option.value === value))
            };
        }).filter(Boolean);
        return result.length ? result : LANGUAGE_OPTIONS.map(item => ({...item}));
    }

    function normalizeFields(input, catalog={}){
        const source = mergeInput(input);
        const visualStyles = optionsFor(catalog, 'visualStyle', VISUAL_STYLE_OPTIONS);
        const compositions = optionsFor(catalog, 'composition', COMPOSITION_OPTIONS);
        const titleEffects = optionsFor(catalog, 'titleEffect', TITLE_EFFECT_OPTIONS);
        const copyPlacements = optionsFor(catalog, 'copyPlacement', COPY_PLACEMENT_OPTIONS);
        return {
            type:'gameKvPrompt',
            promptKind:'game-kv',
            kvVersion:Math.max(1, Number(firstValue(source, ['kvVersion','version'])) || BASE_DEFAULTS.kvVersion),
            visualStyle:choiceValue(source, ['visualStyle','style'], BASE_DEFAULTS.visualStyle, visualStyles),
            composition:choiceValue(source, ['composition','layout'], BASE_DEFAULTS.composition, compositions),
            mainTitle:textValue(source, ['mainTitle','headline','mainText','title'], BASE_DEFAULTS.mainTitle),
            copyEnabled:booleanValue(source, ['copyEnabled','adCopyEnabled','includeCopy','textEnabled','includeText'], BASE_DEFAULTS.copyEnabled),
            subtitleEnabled:booleanValue(source, ['subtitleEnabled','showSubtitle','includeSubtitle'], BASE_DEFAULTS.subtitleEnabled),
            subtitle:textValue(source, ['subtitle','subTitle','subtext'], BASE_DEFAULTS.subtitle),
            image1Role:textValue(source, ['image1Role','imageOneRole','reference1Role','image1Label','reference1Label'], BASE_DEFAULTS.image1Role),
            image1Instruction:textValue(source, ['image1Instruction','imageOneInstruction','reference1Instruction','image1Prompt','reference1Prompt'], BASE_DEFAULTS.image1Instruction),
            image2Role:textValue(source, ['image2Role','imageTwoRole','reference2Role','image2Label','reference2Label'], BASE_DEFAULTS.image2Role),
            image2Instruction:textValue(source, ['image2Instruction','imageTwoInstruction','reference2Instruction','image2Prompt','reference2Prompt'], BASE_DEFAULTS.image2Instruction),
            references:normalizeReferences(source, catalog),
            titleEffect:choiceValue(source, ['titleEffect','fontEffect','fontStyle','typography'], BASE_DEFAULTS.titleEffect, titleEffects),
            copyPlacement:choiceValue(source, ['copyPlacement','placement','copyLayout'], BASE_DEFAULTS.copyPlacement, copyPlacements),
            useFontReference:booleanValue(source, ['useFontReference','useImage2Typography','useImage2','includeImage2'], BASE_DEFAULTS.useFontReference),
            showLogo:booleanValue(source, ['showLogo','includeLogo','addLogo'], BASE_DEFAULTS.showLogo),
            logoReference:textValue(source, ['logoReference'], BASE_DEFAULTS.logoReference),
            downloadButtonEnabled:booleanValue(source, ['downloadButtonEnabled'], BASE_DEFAULTS.downloadButtonEnabled),
            downloadButtonCustom:booleanValue(source, ['downloadButtonCustom'], BASE_DEFAULTS.downloadButtonCustom),
            downloadButtonReference:textValue(source, ['downloadButtonReference'], BASE_DEFAULTS.downloadButtonReference),
            noLogo:booleanValue(source, ['noLogo','excludeLogo','noGameLogo'],
                firstValue(source, ['noLogo','excludeLogo','noGameLogo']) === undefined
                    ? !booleanValue(source, ['showLogo','includeLogo','addLogo'], BASE_DEFAULTS.showLogo)
                    : BASE_DEFAULTS.noLogo),
            qualityEnabled:booleanValue(source, ['qualityEnabled','includeQuality','showQuality'], BASE_DEFAULTS.qualityEnabled),
            negativeEnabled:booleanValue(source, ['negativeEnabled','includeNegative'], BASE_DEFAULTS.negativeEnabled),
            adLanguage:textValue(source, ['adLanguage','language'], BASE_DEFAULTS.adLanguage),
            adLanguageOptions:normalizeLanguages(firstValue(source, ['adLanguageOptions','languageOptions'])),
            extraPrompt:textValue(source, ['extraPrompt','extraRequirements','extra'], BASE_DEFAULTS.extraPrompt),
            negativePrompt:textValue(source, ['negativePrompt','negative'], BASE_DEFAULTS.negativePrompt)
        };
    }

    function optionPrompt(options, value){
        const option = options.find(item => item.value === value || item.label === value || item.prompt === value);
        if(!option) return String(value || '').trim();
        if(option.custom && option.label && !option.prompt.includes(option.label)){
            return `${option.label}：${option.prompt}`;
        }
        return option.prompt;
    }

    function referenceRule(number, role, instruction, fallbackRole, fallbackInstruction){
        const safeRole = String(role || fallbackRole || '').trim() || fallbackRole;
        const safeInstruction = String(instruction || fallbackInstruction || '').trim();
        const lead = `图片${number}${number === 2 ? '仅' : ''}作为${safeRole}参考`;
        if(!safeInstruction) return `${lead}。`;
        return `${lead}，${safeInstruction.replace(/[。！？.!?]+$/u, '')}。`;
    }

    function selectedReference(references, value){
        const key = String(value ?? '').trim();
        if(!key || key === 'none') return null;
        const reference = /^\d+$/.test(key)
            ? references[Number(key) - 1]
            : references.find(item => [item?.sourceKey, item?.id, item?.value].some(candidate => String(candidate ?? '') === key));
        return reference?.enabled === false ? null : reference || null;
    }

    function compileFields(node, catalog={}){
        const visualStyles = optionsFor(catalog, 'visualStyle', VISUAL_STYLE_OPTIONS);
        const compositions = optionsFor(catalog, 'composition', COMPOSITION_OPTIONS);
        const titleEffects = optionsFor(catalog, 'titleEffect', TITLE_EFFECT_OPTIONS);
        const copyPlacements = optionsFor(catalog, 'copyPlacement', COPY_PLACEMENT_OPTIONS);
        const languages = normalizeLanguages(node.adLanguageOptions);
        const language = languages.find(item => item.value === node.adLanguage) || languages[0] || LANGUAGE_OPTIONS[0];
        const sections = [`请生成一张${language.prompt || language.label}的游戏广告KV。`];

        const references = Array.isArray(node.references) ? node.references : [];
        const logoReference = node.showLogo ? selectedReference(references, node.logoReference) : null;
        const buttonReference = node.copyEnabled && node.downloadButtonEnabled && node.downloadButtonCustom
            ? selectedReference(references, node.downloadButtonReference)
            : null;
        const dedicatedKeys = new Set([logoReference, buttonReference].filter(Boolean).map(item => String(item.sourceKey || item.id || item.value)));
        const referenceRules = references
            .filter(item => item && item.enabled !== false)
            .filter(item => !dedicatedKeys.has(String(item.sourceKey || item.id || item.value)))
            .map(item => String(item.prompt || '').trim())
            .filter(Boolean);
        if(referenceRules.length) sections.push(`参考图规则：\n${referenceRules.map(item => `- ${item}`).join('\n')}`);

        const visualStyle = optionPrompt(visualStyles, node.visualStyle);
        const composition = optionPrompt(compositions, node.composition);
        const design = [];
        if(visualStyle) design.push(`视觉风格：${visualStyle}。`);
        if(composition) design.push(`构图：${composition}。`);
        design.push('强调主角、动态姿态和强视觉焦点，背景层次清晰，整体具备商业广告冲击力。');
        sections.push(`画面设计：\n${design.map(item => `- ${item}`).join('\n')}`);

        const subtitle = node.copyEnabled && node.subtitleEnabled ? node.subtitle : '';
        if(node.copyEnabled && (node.mainTitle || subtitle)){
            const copy = [];
            if(node.mainTitle) copy.push(`主标题（必须准确呈现，不得改写）：「${node.mainTitle}」`);
            if(subtitle) copy.push(`副标题（必须准确呈现，字号明显小于主标题，不得改写）：「${subtitle}」`);
            const titleEffect = optionPrompt(titleEffects, node.titleEffect);
            const placementOption = copyPlacements.find(item => item.value === node.copyPlacement || item.label === node.copyPlacement || item.prompt === node.copyPlacement);
            const placementText = placementOption
                ? (subtitle ? placementOption.prompt : (placementOption.singlePrompt || placementOption.prompt))
                : String(node.copyPlacement || '').trim();
            const copyPlacement = placementOption?.custom && placementOption.label && !placementText.includes(placementOption.label)
                ? `${placementOption.label}：${placementText}`
                : placementText;
            if(titleEffect) copy.push(`字体效果：${titleEffect}。`);
            if(copyPlacement) copy.push(`排版位置：${copyPlacement}。`);
            if(node.downloadButtonEnabled){
                const button = buttonReference ? `图片${buttonReference.imageNumber || references.indexOf(buttonReference) + 1}的按钮` : '按钮';
                copy.push(`位于文字区域最下方，${button}包裹文字：${language.buttonText || 'Download'}。`);
            }
            copy.push('除上述指定文案外，不添加其他文字。');
            sections.push(`文字排版：\n${copy.map(item => `- ${item}`).join('\n')}`);
        }else if(node.copyEnabled && node.downloadButtonEnabled){
            const button = buttonReference ? `图片${buttonReference.imageNumber || references.indexOf(buttonReference) + 1}的按钮` : '按钮';
            sections.push(`下载按钮：\n- 位于文字区域最下方，${button}包裹文字：${language.buttonText || 'Download'}。`);
        }

        if(node.qualityEnabled){
            sections.push(`画质要求：\n- ${QUALITY_PROMPT}。`);
        }
        if(node.showLogo){
            const logo = logoReference ? `图片${logoReference.imageNumber || references.indexOf(logoReference) + 1}的游戏Logo，保持样式清晰完整` : '游戏logo';
            sections.push(`限制：\n- 在画面四周角落放置${logo}，确保logo不会变形，出错`);
        }else if(node.noLogo !== false){
            sections.push('限制：\n- 成图不要添加游戏Logo、品牌标识、水印或角标。');
        }
        if(node.extraPrompt){
            sections.push(`额外要求：\n${node.extraPrompt}`);
        }
        if(node.negativeEnabled && node.negativePrompt){
            sections.push(`负向提示词：\n${node.negativePrompt}`);
        }

        return sections.join('\n\n');
    }

    function compile(input, catalog={}){
        return compileFields(normalizeFields(input, catalog), catalog);
    }

    function normalizeNode(input, catalog={}){
        const normalized = normalizeFields(input, catalog);
        return {...normalized, text:compileFields(normalized, catalog)};
    }

    function createNodeData(overrides, catalog={}){
        return normalizeNode(overrides, catalog);
    }

    const DEFAULTS = Object.freeze(normalizeNode(BASE_DEFAULTS));

    return Object.freeze({
        DEFAULTS,
        VISUAL_STYLE_OPTIONS,
        COMPOSITION_OPTIONS,
        TITLE_EFFECT_OPTIONS,
        COPY_PLACEMENT_OPTIONS,
        REFERENCE_OPTIONS,
        LANGUAGE_OPTIONS,
        normalizeNode,
        createNodeData,
        compile
    });
});
