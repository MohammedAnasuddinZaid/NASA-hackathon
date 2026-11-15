"""A clean combined app remains usable when optional speech cannot initialize."""
def test_history_initializes_without_optional_voice(monkeypatch, tmp_path):
    import main
    from app.config import settings
    from fastapi.testclient import TestClient
    from dataclasses import replace
    monkeypatch.setattr(main.database, 'settings', replace(settings, db_path=tmp_path / 'fresh' / 'voice.sqlite3'))
    monkeypatch.setattr(main, '_state', dict(main._state))
    monkeypatch.setattr(main, 'voice_stack', lambda: (_ for _ in ()).throw(main.VoiceUnavailable('not configured')))
    with TestClient(main.app) as client:
        assert client.get('/api/history/sessions').json() == {'sessions': []}
        assert client.get('/api/history/session/unknown').json()['turns'] == []
        assert client.get('/health/ready').status_code == 200
        response = client.post('/api/voice/turn', json={'text': 'BASS2-B1 oxygen'})
        assert response.status_code == 200
        assert response.json()['audio_b64'] is None
        assert response.json()['voice_available'] is False
