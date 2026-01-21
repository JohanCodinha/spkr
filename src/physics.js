// =============================================================================
// MATTER.JS PHYSICS
// =============================================================================

import { config } from './config.js';
import {
    MOBILE_BREAKPOINT,
    DESKTOP_BREAKPOINT,
    MOBILE_THROW_FORCE,
    DESKTOP_THROW_FORCE
} from './constants.js';
import { getState } from './store.js';
import { getCardSize } from './drawing.js';
import { Engine, Bodies, Composite, Body } from 'matter-js';

function getThrowForce() {
    const screenWidth = window.innerWidth;

    if (screenWidth <= MOBILE_BREAKPOINT) return MOBILE_THROW_FORCE;
    if (screenWidth >= DESKTOP_BREAKPOINT) return DESKTOP_THROW_FORCE;

    const t = (screenWidth - MOBILE_BREAKPOINT) / (DESKTOP_BREAKPOINT - MOBILE_BREAKPOINT);
    return MOBILE_THROW_FORCE + t * (DESKTOP_THROW_FORCE - MOBILE_THROW_FORCE);
}

export function initEngine() {
    const eng = Engine.create();
    eng.gravity.y = 0;
    getState().setEngine(eng);
    return eng;
}

export function clearEngine() {
    const { engine } = getState();
    if (engine) {
        Composite.clear(engine.world);
        Engine.clear(engine);
    }
    return initEngine();
}

export function spawnCard(player, value) {
    const { width, height, engine, pushCard } = getState();
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

    pushCard(newCard);
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

export function recallCard(card, targetX, targetY) {
    // Make card static and set recall target
    Body.setStatic(card.body, true);
    card.isRecalling = true;
    card.recallTargetX = targetX;
    card.recallTargetY = targetY;
}

export function removeCardBody(card) {
    const { engine } = getState();
    if (engine && card.body) {
        Composite.remove(engine.world, card.body);
    }
}

export function updateEngine() {
    const { engine } = getState();
    if (engine) {
        Engine.update(engine, 1000 / 60);
    }
}

export { Body, Composite };
