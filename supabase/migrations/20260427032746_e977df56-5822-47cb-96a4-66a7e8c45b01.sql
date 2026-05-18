UPDATE lojas
SET 
  tenfront_bearer_token = (SELECT tenfront_bearer_token FROM lojas WHERE id = 'natal'),
  tenfront_consumer_key = (SELECT tenfront_consumer_key FROM lojas WHERE id = 'natal'),
  tenfront_consumer_secret = (SELECT tenfront_consumer_secret FROM lojas WHERE id = 'natal')
WHERE id = 'campina-grande';

UPDATE lojas
SET 
  tenfront_bearer_token = NULL,
  tenfront_consumer_key = NULL,
  tenfront_consumer_secret = NULL
WHERE id = 'natal';