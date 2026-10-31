FROM checkupino-content-validation:2026-10-08

# Preflight requires the already accepted a48b0c0b image. No install or network.
WORKDIR /opt/checkupino-content
COPY vendor ./vendor
COPY app/Services/MedicalContentValidator.php ./app/Services/MedicalContentValidator.php
COPY app/Support/MedicalContentPolicy.php app/Support/MedicalContentProtocol.php ./app/Support/
COPY config/medical_content.php ./config/medical_content.php
COPY scripts/media/serve-medical-content.php scripts/media/validate-medical-image.php ./scripts/media/

USER 33:33
ENTRYPOINT ["php", "-d", "memory_limit=96M", "-d", "display_errors=0", "-d", "log_errors=0", "/opt/checkupino-content/scripts/media/serve-medical-content.php"]
CMD []
