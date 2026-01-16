// =============================================================================
// MATTER.JS PHYSICS
// =============================================================================

import { config } from './config.js';
import { cards, width, height, engine, setEngine, setCards } from './state.js';
import { getCardSize, getThrowForce } from './utils.js';

const { Engine, Bodies, Composite, Body } = Matter;

export function initEngine() {
    const eng = Engine.create();
    eng.gravity.y = 0;
    setEngine(eng);
    return eng;
}

export function clearEngine() {
    if (engine) {
        Composite.clear(engine.world);
        Engine.clear(engine);
    }
    return initEngine();
}

export function spawnCard(player, value) {
    const startX = player.pos.x * width;
    const startY = player.pos.y * height;
    const cardSize = getCardSize();

    const body = Bodies.rectangle(startX, startY, cardSize.w, cardSize.h, {
        restitution: config.restitution,
        frictionAir: config.frictionAir,
        angle: Math.random() * Math.PI * 2
    });

    const targetX = width / 2 + (Math.random() - 0.5) * 100;
    const targetY = height / 2 + (Math.random() - 0.5) * 100;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const throwForce = getThrowForce();
    const force = throwForce * body.mass;

    Body.applyForce(body, body.position, {
        x: Math.cos(angle) * force,
        y: Math.sin(angle) * force
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * config.spin);

    Composite.add(engine.world, body);

    const newCard = {
        body,
        value,
        player,
        flipProgress: 0,
        targetX: null,
        targetY: null,
        targetAngle: 0
    };

    cards.push(newCard);
    return newCard;
}

export function updateCardPhysics(card) {
    if (card.body) {
        card.body.restitution = config.restitution;
        card.body.frictionAir = config.frictionAir;
    }
}

export function setCardStatic(card, isStatic) {
    Body.setStatic(card.body, isStatic);
}

export function setCardPosition(card, x, y) {
    Body.setPosition(card.body, { x, y });
}

export function setCardAngle(card, angle) {
    Body.setAngle(card.body, angle);
}

export function updateEngine() {
    if (engine) {
        Engine.update(engine, 1000 / 60);
    }
}

export { Body, Composite };
