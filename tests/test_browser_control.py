from src.open_llm_vtuber.agent.browser_control import browser_navigation_url


def test_resolves_explicit_baidu_open_request():
    assert browser_navigation_url("帮我打开百度") == "https://www.baidu.com"


def test_resolves_explicit_http_url():
    assert (
        browser_navigation_url("打开 https://example.com/docs?q=vtuber")
        == "https://example.com/docs?q=vtuber"
    )


def test_ignores_non_navigation_and_unsafe_requests():
    assert browser_navigation_url("百度怎么样？") is None
    assert browser_navigation_url("打开 file:///etc/passwd") is None
