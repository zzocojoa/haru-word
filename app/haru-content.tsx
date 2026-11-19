'use client';
import type {ComponentProps} from 'react';
import {Card} from '@astryxdesign/core/Card';
import {Heading,Text} from '@astryxdesign/core/Text';
/** Existing independently rendered learning panel, with its original design classes. */
export function HaruPanel({className='',...props}:ComponentProps<typeof Card>){
  return <Card {...props} padding={0} variant="transparent" elevation="none" className={`haru-panel ${className}`}/>;
}
export function HaruHeading({className='',level,weight,...props}:ComponentProps<typeof Heading>&{lang?:string}){
  return <Heading {...props} level={level} weight={weight??(level===3?'semibold':undefined)} className={`haru-heading ${className}`}/>;
}
export function HaruParagraph({className='',...props}:Omit<ComponentProps<typeof Text>,'as'|'type'|'display'>&{lang?:string}){
  return <Text {...props} as="p" type="body" display="block" className={`haru-copy ${className}`}/>;
}
