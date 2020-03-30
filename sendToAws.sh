# brew install jq

# make sure docker is running and your AWS CLI is configured
docker build -t virtual-happy-hour .
docker tag virtual-happy-hour 300420735591.dkr.ecr.us-west-2.amazonaws.com/virtual-happy-hour/nodejs
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 300420735591.dkr.ecr.us-west-2.amazonaws.com
docker push 300420735591.dkr.ecr.us-west-2.amazonaws.com/virtual-happy-hour/nodejs
task=$(sed s/\"//g <<<$(aws ecs list-tasks --cluster virtual-happy-hour --output json | jq .taskArns[0]))
# need a pause or loop check
aws ecs run-task --cluster virtual-happy-hour --task $task
# need to start
