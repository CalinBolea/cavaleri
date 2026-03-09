FROM php:8.3-fpm

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libpq-dev \
    libzip-dev \
    libicu-dev \
    && docker-php-ext-install pdo intl pdo_pgsql zip \
    && pecl install apcu && docker-php-ext-enable apcu \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/server

RUN echo "memory_limit=256M" > /usr/local/etc/php/conf.d/memory-limit.ini

RUN mkdir -p var/cache var/log && chown -R www-data:www-data var
