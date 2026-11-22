from unittest.mock import patch
from src.open_llm_vtuber.media.commands import local_command
from src.open_llm_vtuber.agent.history import bounded_history


def test_ambiguous_negated_and_quoted_commands_fall_back():
    for text in ['不要暂停视频', '为什么要暂停视频？', '他说“暂停视频”', '暂停视频然后打开摄像头', '继续读']:
        assert local_command(text, {'local_stage', 'local_bookshelf'}, {}) is None
    assert local_command('暂停视频', set(), {}) is None


def test_duplicate_names_are_not_guessed():
    with patch('src.open_llm_vtuber.media.bookshelf.catalog', return_value=['a/诗集.epub', 'b/诗集.epub']):
        assert local_command('朗读诗集', {'local_bookshelf'}, {}) is None


def test_exact_media_title_avoids_list_then_model_rounds():
    with patch('src.open_llm_vtuber.media.catalog.list_media', return_value={'videos': [{'title': '小熊猫.mp4', 'path': '小熊猫.mp4'}]}):
        assert local_command('播放小熊猫', {'local_stage'}, {}) == ('local_stage', {'action': 'play', 'kind': 'videos', 'path': '小熊猫.mp4'})


def test_history_keeps_complete_recent_turns_without_mutation():
    history = [{'role': role, 'content': text} for role, text in [('user', 'old'), ('assistant', 'reply'), ('user', 'recent'), ('assistant', 'answer')]]
    assert bounded_history(history, 3, 100) == history[-2:]
    assert len(history) == 4
    assert bounded_history(history, 24, 5) == []


def test_switch_command_uses_current_player_without_guessing_a_file():
    assert local_command('换一首', {'local_stage'}, {}) == ('local_stage', {'action': 'next'})
    assert local_command('换一个视频', {'local_stage'}, {}) == ('local_stage', {'action': 'next', 'kind': 'videos'})
    assert local_command('上一首', {'local_stage'}, {}) == ('local_stage', {'action': 'previous', 'kind': 'music'})
    assert local_command('不要换一首', {'local_stage'}, {}) is None


def test_bare_book_choice_in_reading_conversation_resolves_unique_title():
    with patch('src.open_llm_vtuber.media.bookshelf.catalog', return_value=['白居易诗全集.epub', '李太白全集.epub']):
        assert local_command('白居易全集', {'local_bookshelf'}, {'awaiting_book': True}) == ('local_bookshelf', {'action': 'read', 'book': '白居易诗全集.epub', 'start': 0})
        assert local_command('白居易全集', {'local_bookshelf'}, {}) is None
        assert local_command('为什么喜欢白居易全集', {'local_bookshelf'}, {'awaiting_book': True}) is None
