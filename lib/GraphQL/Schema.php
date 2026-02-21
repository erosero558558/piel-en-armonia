<?php

declare(strict_types=1);

namespace App\GraphQL;

use GraphQL\Type\Schema as BaseSchema;

require_once __DIR__ . '/Query.php';
require_once __DIR__ . '/Mutation.php';
require_once __DIR__ . '/Types.php';

class Schema extends BaseSchema
{
    public function __construct()
    {
        $config = [
            'query' => new Query(),
            'mutation' => new Mutation()
        ];
        parent::__construct($config);
    }
}
