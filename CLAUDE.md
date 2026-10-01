# YugiohLegend

## 프로젝트
- 이름: YugiohLegend
- 버전: 0.1.0
- 스택: Electron + Vite (workspace: server + client + WebSocket)
- 빌드: npm run build:all && npx electron-builder --win portable
- 테스트: npm run test --workspace=server

## 구조
- server/: TypeScript 서버
- client/: Vite 클라이언트
- WebSocket 통신
