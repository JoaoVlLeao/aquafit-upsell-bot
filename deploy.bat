@echo off
cd /d "C:\Users\joao-\OneDrive\Desktop\aquafit-upsell.bot"
git add .
git commit -m "auto deploy"
git push origin main
echo ================================
echo ✅ Deploy enviado com sucesso!
pause
