<?php
declare(strict_types=1);

$binDir = __DIR__;
$output = shell_exec("php {$binDir}/notify-lab-critical.php --case_id=test_case_s30 --test=creatinina --value=\"9.2 mg/dL\"");
echo $output;
