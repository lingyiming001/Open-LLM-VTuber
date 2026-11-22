# 本地阅读与媒体模块

音乐与视频共用媒体目录和播放控制，不重复实现两套播放器后端。

| 文件 | 职责 |
| --- | --- |
| `routes.py` | 组合 HTTP 路由，供服务器挂载 |
| `book_text.py` | TXT / PDF / EPUB 提取、章节切分和朗读分段 |
| `reader.py`、`reader.html` | 阅读器页面、书籍导入和 TTS 接口 |
| `bookshelf.py` | 本地书库目录、原文检索和分段读取工具 |
| `catalog.py` | 音乐 / 视频目录及播放文件路径校验 |
| `resources.py` | 书籍、图片、音乐、视频的资源导入和下载 |
| `playback.py` | 播放、暂停、继续、停止、上一项和下一项指令 |
| `transcription.py` | FFmpeg 解码、歌词时间段转写和结果缓存 |
| `context.py` | 按当前话题裁剪的资源上下文 |
| `commands.py` | 无需 LLM 的明确本地指令识别 |
| `tools.py` | 将阅读 / 播放结果转换为统一工具事件 |

原有 `/reader`、`/api/reader/*`、`/api/media/*` URL 和 `local_bookshelf`、
`local_stage` 工具名称保持不变。根目录旧 Python 文件仅用于兼容导入；
项目内部应直接引用本模块中的实现。对话历史裁剪独立放在 `agent/history.py`。
