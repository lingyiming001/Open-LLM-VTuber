"""Extract TXT/PDF/EPUB text into chapters and bounded speech passages."""

import io
import re
import zipfile
import xml.etree.ElementTree as ET

MAX_SIZE = 30 * 1024 * 1024


def extract_book(data: bytes, suffix: str, *, with_chapters=False) -> list:
    if suffix == ".txt":
        for encoding in ("utf-8-sig", "utf-16", "gb18030"):
            try:
                text = data.decode(encoding)
                break
            except UnicodeError:
                continue
        else:
            raise ValueError("无法识别 TXT 编码，请转换为 UTF-8")
    elif suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("请先解密 PDF")
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    elif suffix == ".epub":
        import posixpath

        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if sum(info.file_size for info in archive.infolist()) > 100 * 1024 * 1024:
                raise ValueError("EPUB 解压后过大")
            container = ET.fromstring(archive.read("META-INF/container.xml"))
            package_path = next(
                e.attrib["full-path"]
                for e in container.iter()
                if e.tag.endswith("}rootfile")
            )
            package = ET.fromstring(archive.read(package_path))
            manifest = {
                e.attrib["id"]: e.attrib
                for e in package.iter()
                if e.tag.endswith("}item")
            }
            parts = []
            for entry in package.iter():
                if not entry.tag.endswith("}itemref"):
                    continue
                item = manifest[entry.attrib["idref"]]
                if item.get("media-type") != "application/xhtml+xml":
                    continue
                path = posixpath.normpath(
                    posixpath.join(
                        posixpath.dirname(package_path), item["href"].split("#")[0]
                    )
                )
                root = ET.fromstring(archive.read(path))
                body = next((e for e in root.iter() if e.tag.endswith("}body")), root)
                parts.append("\n".join(body.itertext()))
            text = "\n".join(parts)
    else:
        raise ValueError("仅支持 PDF、EPUB、TXT")
    if not text.strip():
        raise ValueError("未提取到文字；扫描版 PDF 需要先进行 OCR")
    chapters = []
    title = "正文"
    lines = []

    def append_chapter():
        content = re.sub(r"\s+", " ", "\n".join(lines)).strip()
        if not content:
            return
        chunks = []
        for sentence in re.split(r"(?<=[。！？.!?；;])", content):
            sentence = sentence.strip()
            while sentence:
                chunks.append(sentence[:240])
                sentence = sentence[240:]
        chapters.append({"title": title, "chunks": chunks})

    for line in text.splitlines():
        line = line.strip()
        if re.match(
            r"^(第[零〇一二三四五六七八九十百千万两0-9]+[章节回卷部篇].{0,60}|chapter\s+\w+.{0,60})$",
            line,
            re.I,
        ):
            append_chapter()
            title, lines = line, []
        else:
            lines.append(line)
    append_chapter()
    if with_chapters:
        return chapters
    return [chunk for chapter in chapters for chunk in chapter["chunks"]]
