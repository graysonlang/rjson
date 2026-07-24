import { runBuild } from '@graysonlang/esp/esbuild-runner';

function getOptions(args) {
  return {
    assetNames: '[name]',
    bundle: true,
    entryPoints: {
      main: 'demo/main.js',
    },
    format: 'esm',
    loader: {
      '.html': 'file',
    },
    outdir: 'www',
    target: ['esnext'],
    ...args,
  };
}

runBuild(getOptions);
