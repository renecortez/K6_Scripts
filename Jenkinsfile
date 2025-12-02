pipeline {
  agent any

  options {
    ansiColor('xterm')
    timestamps()
  }

  environment {
    // Ajusta si k6 quedó en otra ruta
    K6_BIN = '"C:\\Program Files\\k6\\k6.exe"'
  }

  stages {
    stage('Checkout') {
      steps {
        // Multibranch usa automáticamente la rama detectada
        checkout scm
      }
    }

    stage('Run k6 (Windows)') {
      steps {
        bat '''
        set K6_WEB_DASHBOARD=true
        set K6_WEB_DASHBOARD_OPEN=false
        set K6_WEB_DASHBOARD_EXPORT=%WORKSPACE%\\report.html

        %K6_BIN% version
        %K6_BIN% run Scripts\\QuickPizza1.js --summary-export %WORKSPACE%\\summary.json
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'report.html, summary.json', fingerprint: true, onlyIfSuccessful: false
      // Requiere el plugin "HTML Publisher"
      publishHTML(target: [
        reportDir: '.',
        reportFiles: 'report.html',
        reportName: 'k6 Dashboard',
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true
      ])
    }
  }
}
