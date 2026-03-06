.PHONY: up down build shell-php shell-node db-migrate db-fixtures test-server

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

shell-php:
	docker compose exec php bash

shell-node:
	docker compose exec node sh

db-migrate:
	docker compose exec php php bin/console doctrine:migrations:migrate --no-interaction

db-create:
	docker compose exec php php bin/console doctrine:database:create --if-not-exists

db-diff:
	docker compose exec php php bin/console doctrine:migrations:diff

db-fixtures:
	docker compose exec php php bin/console doctrine:fixtures:load --no-interaction

test-server:
	docker compose exec php php vendor/bin/simple-phpunit

composer-install:
	docker compose exec php composer install

npm-install:
	docker compose run --rm node npm install

install-deps:
	docker compose exec php composer require doctrine/orm doctrine/doctrine-bundle doctrine/doctrine-migrations-bundle symfony/serializer symfony/property-access symfony/property-info symfony/validator symfony/uid nelmio/cors-bundle --no-interaction
	docker compose exec php composer require --dev symfony/phpunit-bridge doctrine/doctrine-fixtures-bundle symfony/maker-bundle --no-interaction

logs:
	docker compose logs -f

setup: build up install-deps composer-install db-create db-migrate
