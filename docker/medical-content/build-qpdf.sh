#!/bin/sh
set -eu

# Official upstream 12.4.2 source and release asset SHA-256, verified October 8.
# Build-time only; neither runtime updates nor patient content leave the host.
task_archive=/tmp/checkupino-qpdf-12.4.2.tar.gz
curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 \
    https://github.com/qpdf/qpdf/releases/download/v12.4.2/qpdf-12.4.2.tar.gz \
    --output "$task_archive"
printf '%s  %s\n' '8a58af5b6141319287c1883bec8bd1bd545b7567b7fc5e6ce5d25a1c85f36397' "$task_archive" | sha256sum --check -
mkdir -p /tmp/checkupino-qpdf-source
tar -xzf "$task_archive" -C /tmp/checkupino-qpdf-source --strip-components=1
cmake -S /tmp/checkupino-qpdf-source -B /tmp/checkupino-qpdf-build \
    -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DBUILD_STATIC_LIBS=ON \
    -DBUILD_DOC=OFF -DINSTALL_EXAMPLES=OFF -DUSE_IMPLICIT_CRYPTO=OFF \
    -DREQUIRE_CRYPTO_OPENSSL=ON -DDEFAULT_CRYPTO=openssl
cmake --build /tmp/checkupino-qpdf-build --target qpdf --parallel 2
install -m 0755 /tmp/checkupino-qpdf-build/qpdf/qpdf /usr/local/bin/qpdf
/usr/local/bin/qpdf --version
rm -rf /tmp/checkupino-qpdf-source /tmp/checkupino-qpdf-build "$task_archive"
