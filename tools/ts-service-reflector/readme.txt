npm run build

# basic
npx ts-service-reflector

# custom config
npx ts-service-reflector --tsconfig tsconfig.app.json --out metadata.json

# watch mode
npx ts-service-reflector --watch
