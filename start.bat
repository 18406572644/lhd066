@echo off
echo ========================================
echo  Mockup Studio Docker 一键启动
echo ========================================
echo.
echo [1/2] 构建并启动服务...
docker-compose up -d --build
echo.
echo [2/2] 检查服务状态...
docker-compose ps
echo.
echo ========================================
echo  服务启动完成！
echo  前端地址: http://localhost:2066
echo  后端地址: http://localhost:6066
echo ========================================
echo.
echo 停止服务请运行: stop.bat
echo 查看日志请运行: docker-compose logs -f
pause
