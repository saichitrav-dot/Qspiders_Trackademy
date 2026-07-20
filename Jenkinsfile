def branch = "master"

pipeline {
    agent any

    environment {
        // Baked into the Vite bundle at BUILD time (Vite only exposes VITE_* vars).
        // These are CLIENT-side values — the anon key is a public key protected by RLS —
        // so inlining is acceptable. For one source of truth, create Jenkins "Secret text"
        // credentials and swap the two lines below for:
        //   VITE_SUPABASE_URL      = credentials('vite-supabase-url')
        //   VITE_SUPABASE_ANON_KEY = credentials('vite-supabase-anon-key')
        VITE_SUPABASE_URL      = 'http://trackademy.onqtrack.com'
        VITE_SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyNzMxNTc3LCJleHAiOjIwOTgwOTE1Nzd9.swdgyQ7-b9nCyCc3Pbo8S7ivmD_4FqvAaKMjczgLwBQ'
    }

    stages {
        stage('Cloning the Code') {
            steps {
                git branch: "${branch}", url: 'https://github.com/saichitrav-dot/Qspiders_Trackademy.git'
            }
        }

        stage('Build and Push Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-prod',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

                        docker build \
                          --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
                          --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
                          -t saichitra/trackademy:v1 .

                        docker push saichitra/trackademy:v1

                        docker logout
                    '''
                }
            }
        }

        stage('Deployement') {
            steps {
                sshPublisher(publishers: [sshPublisherDesc(configName: 'dev2', transfers: [sshTransfer(cleanRemote: false, excludes: '', execCommand: 'cd /home/kadmin/trackademy-prod && sudo docker compose pull && sudo docker compose up -d', execTimeout: 6000000, flatten: false, makeEmptyDirs: false, noDefaultExcludes: false, patternSeparator: '[, ]+', remoteDirectory: '', remoteDirectorySDF: false, removePrefix: '', sourceFiles: '')], usePromotionTimestamp: false, useWorkspaceInPromotion: false, verbose: true)])
            }
        }
    }
}
