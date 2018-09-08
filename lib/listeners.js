'use strict';

module.exports = class Listeners
{
	constructor()
	{
		this._channels = new Map();
	}

	get( channel, topic )
	{
		let topics, listeners;

		return (( topics = this._channels.get( channel )) && ( listeners = topics.get( topic ))) ? listeners.values() : [];
	}

	add( channel, topic, listener )
	{
		let topics, listeners;

		(( topics = this._channels.get( channel )) || ( this._channels.set( channel, topics = new Map() )));
		(( listeners = topics.get( topic )) || ( topics.set( topic, listeners = new Set() )));

		listeners.add( listener );
	}

	remove( channel, topic, listener )
	{
		let topics, listeners;

		if(( topics = this._channels.get( channel )) && ( listeners = topics.get( topic )))
		{
			if( listeners.delete( listener ) && !listeners.size && topics.delete( topic ) && !topics.size )
			{
				this._channels.delete( channel );
			}
		}
	}
}
