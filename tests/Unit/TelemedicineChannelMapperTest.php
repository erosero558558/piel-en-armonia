<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../lib/telemedicine/TelemedicineChannelMapper.php';

final class TelemedicineChannelMapperTest extends TestCase
{
    public function testMapsLegacyTelefonoToPhoneChannel(): void
    {
        $this->assertSame('phone', \TelemedicineChannelMapper::mapServiceToChannel('telefono'));
        $this->assertTrue(\TelemedicineChannelMapper::isTelemedicineService('telefono'));
    }

    public function testMapsLegacyVideoToSecureVideoChannel(): void
    {
        $this->assertSame('secure_video', \TelemedicineChannelMapper::mapServiceToChannel('video'));
        $this->assertTrue(\TelemedicineChannelMapper::requiresCasePhotos('secure_video'));
    }
}
