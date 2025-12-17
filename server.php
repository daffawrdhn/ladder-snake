<?php
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use LadderSnake\GameServer;
use React\EventLoop\Loop;

require dirname(__FILE__) . "/vendor/autoload.php";

error_reporting(E_ALL ^ E_DEPRECATED);

// Explicitly get the loop (newer ReactPHP/Ratchet versions)
// If older, IoServer::factory creates one internally which we can"t easily access *before* instantiation unless we use manual setup.
// Manual setup:
$loop = React\EventLoop\Factory::create();

$gameServer = new GameServer($loop);

$server = new IoServer(
    new HttpServer(
        new WsServer(
            $gameServer
        )
    ),
    new React\Socket\Server("0.0.0.0:8080", $loop),
    $loop
);

echo "Server started on port 8080\n";
$server->run();

