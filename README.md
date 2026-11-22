uv run python scripts/run_with_services.py


cd frontend
npm run dev
npm run build

npm --prefix frontend run build
uv run python scripts/run_with_services.py


uv run python scripts/run_bilibili_live.py

uv run --extra control python scripts/run_with_services.py

 
