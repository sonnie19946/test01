import { getTemplate, sanitizePromptText } from '@/lib/promptTemplates'

export function buildPromptFromData(data: Record<string, any>, type: string): string {
  const parts: string[] = []
  const str = (k: string) => (data[k] as string) ?? ''
  const strArr = (k: string) => ((data[k] as string[]) ?? []).join(', ')
  const nested = (k: string, sub: string) => ((data[k] as Record<string, string>)?.[sub]) ?? ''

  switch (type) {
    case 'character': {
      const name = str('name') || '角色';
      const gender = str('gender');
      const age = str('ageRange');
      const summary = str('summary');
      const traits = strArr('keyTraits');
      const eraSetting = str('eraSetting');

      const faceShape = str('faceShape');
      const skinTone = str('skinTone');
      const eyes = str('eyes');
      const nose = str('nose');
      const mouth = str('mouth');
      const eyebrows = str('eyebrows');
      const chin = str('chin');
      const hair = str('hair');

      const tpl = getTemplate('character')
      parts.push(tpl.prefix);
      
      let intro = `镜头聚焦于角色“${name}”的正面特写。`;
      if (eraSetting) intro += `时代背景为${eraSetting}，`;
      if (age) intro += `身世设定为${age}，`;
      if (gender) intro += `性别${gender}，`;
      parts.push(intro);

      if (tpl.constraints) parts.push(tpl.constraints);
      
      if (summary || traits) {
          parts.push([summary, traits].filter(Boolean).join('，') + '。');
      }

      const features = [
          skinTone,
          faceShape,
          eyes,
          eyebrows,
          nose,
          mouth,
          chin
      ].filter(Boolean);
      
      if (features.length > 0) {
          parts.push(features.join('，') + '。');
      }
      
      if (hair) {
          parts.push(`${hair}，散落在额头和脸庞周围。`);
      }
      
      parts.push(tpl.suffix);
      break;
    }
    case 'appearance': {
      const tplApp = getTemplate('appearance')
      parts.push(tplApp.prefix);
      
      if (str('eraSetting')) parts.push(`整体美学 / 时代背景：${str('eraSetting')}`);
      if (str('characterName')) parts.push(`角色：${str('characterName')} ${str('versionName') ? `(${str('versionName')})` : ''}`);
      if (str('silhouette')) parts.push(`轮廓体态：${str('silhouette')}`);
      if (str('temporalState')) parts.push(`剧作状态与伤痕：${str('temporalState')}`);
      const clothingParts = [];
      if (str('headwear')) clothingParts.push(`头部与面部配饰：${str('headwear')}`);
      if (str('upperBody')) clothingParts.push(`上半身：${str('upperBody')}`);
      if (str('lowerBody')) clothingParts.push(`下半身：${str('lowerBody')}`);
      if (str('footwear')) clothingParts.push(`鞋靴：${str('footwear')}`);
      if (str('accessories')) clothingParts.push(`道具手部细节：${str('accessories')}`);
      if (clothingParts.length > 0) {
         parts.push(`服装细节：${clothingParts.join('。')}`);
      }

      if (str('clothingIdentity')) parts.push(`着装暗示：${str('clothingIdentity')}`);
      if (str('colorScheme')) parts.push(`色彩分布：${str('colorScheme')}`);

      if (tplApp.constraints) parts.push(tplApp.constraints);
      parts.push(tplApp.suffix);
      break
    }
    case 'scene': {
      const tplScene = getTemplate('scene')
      parts.push(tplScene.prefix);
      const sceneMain = [str('eraSetting'), str('name')].filter(Boolean).join(' ');
      if (sceneMain) {
         parts.push(`世界观与区域：${sceneMain}`);
      }
      if (str('architectureAndTopology')) parts.push(`建筑拓扑与空间结构：${str('architectureAndTopology')}`);
      if (str('materialsAndWeathering')) parts.push(`地表植被与侵蚀材质：${str('materialsAndWeathering')}`);
      if (str('staticVisualAnchors')) parts.push(`核心视觉锚点：${str('staticVisualAnchors')}`);
      const lightingParts = [];
      if (str('lightingAndAtmosphere')) lightingParts.push(`光影与大气介质：${str('lightingAndAtmosphere')}，包含电影级体积光（Volumetric lighting）`);
      if (str('colorPalette')) lightingParts.push(`色彩方案：${str('colorPalette')}`);
      if (lightingParts.length > 0) {
         parts.push(lightingParts.join('。 '));
      }

      if (tplScene.constraints) parts.push(tplScene.constraints);
      parts.push(tplScene.suffix);
      break
    }
    case 'prop': {
      const tplProp = getTemplate('prop')
      parts.push(tplProp.prefix);
      const mainObj = [str('eraSetting'), str('name')].filter(Boolean).join(' ');
      if (mainObj) {
         parts.push(`核心物件：${mainObj}`);
      }
      if (nested('appearance', 'baseStructure')) parts.push(`几何结构：${nested('appearance', 'baseStructure')}`);
      if (nested('appearance', 'materialAndWear')) parts.push(`实物材质与物理老化：${nested('appearance', 'materialAndWear')}`);
      if (nested('appearance', 'scaleAndWeight')) parts.push(`体量与视觉重量：${nested('appearance', 'scaleAndWeight')}`);
      if (nested('appearance', 'manufacturing')) parts.push(`制造工艺与时代感：${nested('appearance', 'manufacturing')}`);
      if (nested('appearance', 'interactiveTraces')) parts.push(`剧作使用痕迹与填充物：${nested('appearance', 'interactiveTraces')}`);
      
      if (tplProp.constraints) parts.push(tplProp.constraints);
      parts.push(tplProp.suffix);
      break
    }
    case 'shot':
      if (str('number')) parts.push(`分镜：${str('number')}`)
      if (str('title')) parts.push(`标题：${str('title')}`)
      if (str('plot')) parts.push(`情节：${str('plot')}`)
      if (str('camera')) parts.push(`机位：${str('camera')}`)
      if (str('composition')) parts.push(`构图：${str('composition')}`)
      if (str('action')) parts.push(`动作：${str('action')}`)
      if (str('emotion')) parts.push(`情绪：${str('emotion')}`)
      if (str('visualFocus')) parts.push(`焦点：${str('visualFocus')}`)
      if (str('specialRequirements')) parts.push(`要求：${str('specialRequirements')}`)
      break
    case 'prompt':
      if (str('fullPrompt')) parts.push(str('fullPrompt'))
      if (str('negativePrompt')) parts.push(`负面：${str('negativePrompt')}`)
      if (str('subject')) parts.push(`主体：${str('subject')}`)
      if (str('environment')) parts.push(`环境：${str('environment')}`)
      ;(['camera', 'composition', 'style', 'quality'] as const).forEach(k => {
        const val = nested('technical', k)
        if (val) parts.push(`${{ camera: '镜头', composition: '构图', style: '风格', quality: '质量' }[k]}：${val}`)
      })
      break
    default: {
      const fallback = data.refinedPrompt || data.summary || data.description || data.name || ''
      if (fallback) parts.push(fallback)
    }
  }
  const raw = type === 'character' ? parts.join('') : parts.join('，')
  return sanitizePromptText(raw)
}
