FROM php:8.2-apache

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y \
    libzip-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libicu-dev \
    unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd zip intl pdo_mysql opcache

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Enable Apache modules
RUN a2enmod rewrite headers

# Set working directory
WORKDIR /var/www/html

# Copy application code
COPY . /var/www/html/

# Install Composer dependencies
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
RUN composer install --no-dev --optimize-autoloader

# Create data directory and set permissions
RUN mkdir -p /var/www/data && \
    chown -R www-data:www-data /var/www/html /var/www/data && \
    chmod -R 755 /var/www/html && \
    chmod -R 775 /var/www/data

# Configure Apache DocumentRoot if needed (default is /var/www/html which is correct)
# But we might need to adjust apache config to allow .htaccess overrides
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Set environment variable for data directory
ENV PIELARMONIA_DATA_DIR=/var/www/data

EXPOSE 80
