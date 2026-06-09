const unsupported = (): never => {
  throw new Error(
    'react-native-fs is unavailable in browser builds of @cxing/media-loader.',
  );
};

const shim = {
  readFile: unsupported,
  stat: unsupported,
  open: unsupported,
  read: unsupported,
  close: unsupported,
};

export default shim;
