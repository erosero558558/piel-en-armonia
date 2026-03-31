<?php
require 'lib/common.php';
$store = read_store();
echo implode(", ", array_keys($store));
