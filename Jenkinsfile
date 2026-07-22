def branch = "master"

pipeline {
    agent any

    environment {
        // Baked into the Vite bundle at BUILD time (Vite only exposes VITE_* vars).
        // Client-side values — anon key is public and protected by RLS. For one source of
        // truth, create Jenkins "Secret text" credentials and use credentials('...') instead.
        VITE_SUPABASE_URL      = 'http://trackademy.onqtrack.com'
        VITE_SUPABASE_ANON_KEY = 'eyJ0eXAi•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
    }

    stages {
        stage('Cloning the Code') {
            steps {
                // clean the workspace first so an old checkout can never leak into the build
                cleanWs()
                git branch: "${branch}", url: 'https://github.com/saichitrav-dot/Qspiders_Trackademy.git'
                sh 'npm install'
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

                        docker build --no-cache --pull \
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
                sshPublisher(publishers: [sshPublisherDesc(configName: 'dev2', transfers: [sshTransfer(cleanRemote: false, excludes: '', execCommand: 'cd /home/kadmin/trackademy-prod && sudo docker compose pull && sudo docker compose up -d --force-recreate && sudo docker image prune -f', execTimeout: 6000000, flatten: false, makeEmptyDirs: false, noDefaultExcludes: false, patternSeparator: '[, ]+', remoteDirectory: '', remoteDirectorySDF: false, removePrefix: '', sourceFiles: '')], usePromotionTimestamp: false, useWorkspaceInPromotion: false, verbose: true)])
            }
        }
    }
}