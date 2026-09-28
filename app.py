import gradio as gr

def greet():
    return "欢迎使用无限画布 (Infinite-Canvas)！本项目为桌面端 AI 工作台，请下载本地客户端运行。"

with gr.Blocks(title="无限画布 - Infinite Canvas") as demo:
    gr.Markdown("# 🎨 无限画布 (Infinite-Canvas)")
    gr.Markdown("### 这是基于大雄画布，更新修改的一个集成了文生图、细节增强、节点式工作流与广告KV排版的新画布节点。")
    gr.Markdown("- **开发者**：谢馒头")
    gr.Markdown("- **GitHub 源码**：[xiemantou86-coder/Xiemantou_Huabu](https://github.com/xiemantou86-coder/Xiemantou_Huabu)")
    gr.Markdown("- **更新源状态**：🟢 阿里魔搭国内镜像更新源正常运行中")
    gr.Markdown("---")
    gr.Markdown("*如需使用完整画布能力，请下载本地客户端双击 run.bat 启动。*")

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)