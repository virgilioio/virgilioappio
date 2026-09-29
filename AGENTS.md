
- Client pipeline links live at /cp/:token (not /p/, which serves legacy job-post links); the pipeline-public function delegates dossier rendering to dossier-public via an internal service-key call so there is one client-ready serializer.
