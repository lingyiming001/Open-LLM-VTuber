from src.open_llm_vtuber.media.book_text import extract_book


def test_chapters_and_legacy_chunks():
    data = '序言。\n第一章 初见\n你好。再见！\n第二章 重逢\n新的故事。'.encode()
    chapters = extract_book(data, '.txt', with_chapters=True)
    assert [c['title'] for c in chapters] == ['正文', '第一章 初见', '第二章 重逢']
    assert chapters[1]['chunks'] == ['你好。', '再见！']
    assert extract_book(data, '.txt') == [s for c in chapters for s in c['chunks']]


def test_long_unpunctuated_text_and_english_chapters():
    chapters = extract_book(('Chapter 1 Beginning\n' + 'a' * 500 + '\nChapter 2 End\nDone.').encode(), '.txt', with_chapters=True)
    assert len(chapters) == 2
    assert list(map(len, chapters[0]['chunks'])) == [240, 240, 20]
