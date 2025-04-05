{pkgs}: {
  deps = [
    pkgs.which
    pkgs.libpng
    pkgs.libjpeg_turbo
    pkgs.libGLU
    pkgs.libGL
    pkgs.postgresql
    pkgs.openssl
  ];
}
