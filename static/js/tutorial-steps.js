(function () {
    'use strict';
    // Coordinates are percentages of the supplied, uncropped 1920 × 1080 screenshots.
    window.TUTORIAL_DATA = [
        { image:'1首页.jpg', title:'从一个想法，到第一张作品', chapter:'欢迎来到无限画布', description:'用 12 个画面认识整个流程：配置模型、创建节点、连接提示词，再看到一只小猫诞生。跟着光标看，按自己的节奏前进。', note:'这里是操作演示，无需填写 Key，也不会产生生成费用。', button:'开始体验', points:[[50,50,'hover']], card:'right' },
        { image:'2侧边栏引导.jpg', title:'先认识左侧导航', chapter:'上篇 · 配置生成引擎', description:'左侧可以切换功能，底部的「更多设置」可展开其他选项。「API 设置」就在它的上方。', note:'接下来，我们先配置生成图片所需的接口。', points:[[4.3,65.8,'click'],[4.3,62.8,'hover']], card:'right' },
        { image:'3点击api设置.jpg', title:'进入 API 设置', chapter:'上篇 · 配置生成引擎', description:'点击左下角的「API 设置」。在这里添加平台、填写请求地址和 API Key，并管理可用模型。', points:[[4.3,62.8,'click']], card:'right' },
        { image:'4引导填写api.jpg', title:'填入你的连接凭证', chapter:'上篇 · 配置生成引擎', description:'添加平台，填入服务商提供的请求地址与 API Key，再点击「验证协议」，检查接口能否正确连接。', note:'截图中的地址是示例；实际填写时使用你自己的凭证。', points:[[50,37.3,'pulse'],[49,44.1,'pulse'],[45.8,50.8,'click']], card:'left' },
        { image:'5拉取模型.jpg', title:'选好要用的生图模型', chapter:'上篇 · 配置生成引擎', description:'点击「拉取模型」后，在清单中勾选需要的生图模型，再点右下角「应用到模型列表」。', note:'模型清单由你所使用的平台提供。', points:[[37.45,45.6,'click'],[37.45,52.2,'click'],[63.5,87.8,'click']], card:'left' },
        { image:'6保存.jpg', title:'别忘了最后一步：保存', chapter:'上篇 · 配置生成引擎', description:'点击右上角「保存」，把平台和模型设置保存下来。准备好引擎，就可以前往画布了。', points:[[74,16.9,'gold']], card:'right' },
        { image:'7引导侧面栏点击画布.jpg', title:'回到无限画布', chapter:'下篇 · 连接你的第一张作品', description:'点击左侧「无限画布」，进入画布管理页。每张画布都可以保存一套独立的创作流程。', points:[[4.3,47.8,'click']], card:'right' },
        { image:'8引导创建画布.jpg', title:'创建一张普通画布', chapter:'下篇 · 连接你的第一张作品', description:'点击「新建画布」，选择「普通画布」，然后点击「创建」。先从自由连接节点开始。', points:[[50.4,54.9,'click'],[50.3,59.2,'click']], card:'right' },
        { image:'9引导右键打开节点列表，点击api生成.jpg', title:'右键，呼出你的工具箱', chapter:'下篇 · 连接你的第一张作品', description:'在空白处右键，选择「API 生成」。同样的方法可以添加「提示词」节点，用来描述你想生成的画面。', points:[[47.6,40.2,'right'],[50.5,63.2,'click']], card:'right' },
        { image:'9.5-prompt-node.jpg', title:'创建提示词节点', chapter:'下篇 · 连接你的第一张作品', description:'在节点菜单中点击「提示词」，创建提示词节点，用来写下你想生成的画面描述。', note:'先添加提示词，再把它连接到 API 生成节点。', points:[[26.1,38.8,'click']], card:'right' },
        { image:'10引导连线.jpg', title:'让文字沿着连线流动', chapter:'下篇 · 连接你的第一张作品', description:'按住提示词节点右侧圆点，拖到 API 生成节点左侧的输入点。连好后，提示词就会传给生成器。', note:'左边写要求，中间生成，右边接收结果。', points:[[32.03,40.74,'drag',39.74,47.6]], card:'right' },
        { image:'11生成展示.jpg', title:'你的第一只小猫，诞生了', chapter:'接下来 · 亲手试一试', description:'写提示词、连线、点击「API 生成」，结果就会出现在 OUTPUT 中。进入同样的三节点画布，亲手试一试。', note:'小猫是预置示例图。重新生成前，请配置自己的 API 和模型。', button:'进入小猫演示画布', points:[[53.2,72.3,'click'],[72.6,46.5,'result']], card:'right' }
    ];
})();
