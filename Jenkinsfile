pipeline {
  agent any

  options {
    timestamps()
  }

  environment {
    // Ruta encontrada de k6 instalada con Scoop
    K6_BIN = 'C:\\Users\\Rene_Cortez\\scoop\\shims\\k6.exe'
  }

  stages {
    stage('Checkout') {
      steps {
        git url: 'https://github.com/renecortez/K6_Scripts.git', branch: 'main', credentialsId: 'github_token'
      }
    }

    stage('Run k6 (Windows)') {
      steps {
        bat '''
        setlocal EnableDelayedExpansion

        rem === Configuración del dashboard HTML ===
        set K6_WEB_DASHBOARD=true
        set K6_WEB_DASHBOARD_OPEN=false
        set "K6_WEB_DASHBOARD_EXPORT=%WORKSPACE%\\report.html"

        rem === Verificar versión de k6 y ejecutar prueba ===
        "%K6_BIN%" version
        "%K6_BIN%" run "Scripts\\QuickPizza1.js" --summary-export "%WORKSPACE%\\summary.json"

        endlocal
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'report.html, summary.json', fingerprint: true, onlyIfSuccessful: false
      echo "Reportes archivados: %WORKSPACE%\\report.html y %WORKSPACE%\\summary.json"
    }
  }
}
