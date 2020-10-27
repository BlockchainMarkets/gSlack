all:

create-export:
	gcloud --project=$$PROJECT pubsub topics create gcp-alert-service
	
	gcloud --project=$$PROJECT logging sinks create bmidata_negative_balance \
		pubsub.googleapis.com/projects/$$PROJECT/topics/gcp-alert-service \
		--log-filter "resource.type=\"aws_ec2_instance\" labels.container_name=\"bmi-data\""

	gcloud --project=$$PROJECT projects add-iam-policy-binding $$PROJECT \
		--member=$$(gcloud --project $$PROJECT --format="value(writer_identity)" beta logging sinks describe bmidata_negative_balance) \
		--role='roles/pubsub.publisher'

	gsutil mb -p $$PROJECT gs://$$PROJECT-gcp-alert-service

	gcloud --project=$$PROJECT services enable cloudfunctions.googleapis.com

deploy-function:
	gcloud --project=$$PROJECT functions deploy gcp-alert-service \
		--stage-bucket $$PROJECT-gcp-alert-service --trigger-topic gcp-alert-service \
		--entry-point=pubsubLogSink --region=northamerica-northeast1 --runtime=nodejs10
