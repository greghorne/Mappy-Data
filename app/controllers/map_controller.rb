require 'rest-client'
require 'pg'
# require 'rgeo-geo_json'
require 'json'
require 'benchmark'

TRACE = ENV['TRACE'] || false

class MapController < ApplicationController

  def get_conn(db_server_port)
    host      = ENV['MAPPY_DB_HOST']
    dbname    = ENV['MAPPY_DB']
    # port      = ENV['MAPPY_DB_PORT']
    port      = db_server_port
    user      = ENV['MAPPY_DB_USER']
    password  = ENV['MAPPY_DB_PASSWORD']

    # PGconn.open seems to have quit working with Gem update 
    conn = PG::Connection.open(
      :host => host,
      :dbname => dbname,
      :port => port,
      :user => user,
      :password => password
    )
    

    return conn
  end


  def check_region

    lat = params[:lat].to_f
    lng = params[:lng].to_f
    db_server_port = params[:db_server_port].to_i

    conn = get_conn(db_server_port)

    # insert x,y into table
    insert = "insert into user_point (name, geom) VALUES ('', ST_GeomFromText('Point(" + lng.to_s + " " + lat.to_s + ")', 4269)) RETURNING id"
    result = conn.query(insert)

    # determine if x,y intersects the states layer
    select = "SELECT tl_2016_us_state.gid FROM tl_2016_us_state, user_point WHERE user_point.id = $1 AND ST_Intersects(user_point.geom, tl_2016_us_state.geom);"
    result = conn.query(select, [result[0]['id']])

    if (result.count > 0) 
      render :json => { result: true } 
    else 
      render :json => { result: false } 
    end

  end


  #
  # usa map is broken up into 4 regions, determine which region to use
  #
  def getRegion(lat, lng)
    if (lng <= -100 and lat <= 36)      
      return "southwest"
    elsif (lng <= -100 and lat >= 36)
      return "northwest"
    elsif (lng >= -100 and lat >= 36)
      return "northeast"
    elsif (lng >= -100 and lat <= 36)
      return "southeast"
    else
      return false
    end
  end


  def do_r360_iso(latitude_y, longitude_x, time, region, insert_table, db_server_port)

    r360_key = ENV['MAPPY_R360_KEY']

    r360_url_string = "https://service.route360.net/na_" +
                  region.to_s + "/v1/polygon?cfg={'sources':[{'lat':" + 
                  latitude_y.to_s + ",'lng':" + longitude_x.to_s + 
                  ",'id':'Mappy','tm':{'car':{}}}],'polygon':" +
                  "{'serializer':'geojson','srid':'4326'," +
                  "'values':[" + time.to_s + "]}}&key=" + r360_key.to_s

    # r360 rest call
    Time.now if TRACE
    response_r360 = RestClient.get r360_url_string
    if TRACE
      puts ""
      puts "===> response_r360 (drive polygon api call): " + (Time.now - start).to_s
      puts ""
    end

    # polygon geometry and area (sq metres)
    geometry  = JSON.parse(response_r360)['data']['features'][0]['geometry']
    area      = JSON.parse(response_r360)['data']['features'][0]['properties']['area']

    # stringify JSON object then a couple of minor mainpulations for preparing to use in a db insert statement
    isochrone_r360 = geometry.to_s.gsub('"', '\'').gsub('=>', ':')

    # insert query string
    db_insert = "insert into " + insert_table.to_s + "  (geom) VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), 4269)) RETURNING id"

    conn = get_conn(db_server_port)
    result_db_insert = conn.query(db_insert, [isochrone_r360])
    conn.close

    # inserted row number
    row   = result_db_insert.first['id']

    return_hash = { :success          => true,
                    :table_row_number => row,
                    :geometry         => geometry,
                    :area             => area
                  }

    return JSON.generate(return_hash)
  end


  def do_buffer(buffer, row, table_name_source, insert_table, db_server_port)

    # create buffer on geom
    db_buffer = 'Select ST_Buffer(geom, $1) from ' + table_name_source.to_s + ' where id = $2'

    conn = get_conn(db_server_port)

    Time.now if TRACE
    result_db_buffer = conn.query(db_buffer, [buffer, row])
    puts ""
    puts "===> result_db_buffer (buffer creation on iso): " + (Time.now - start).to_s
    puts ""

    # retrieve buffered geometry
    geometry = result_db_buffer[0]['st_buffer']

    # check the buffer geometry type
    buffer_geom_type = 'select ST_GeometryType($1)'
    result_buffer_geom_type = conn.query(buffer_geom_type, [geometry])
    polygon_type = result_buffer_geom_type[0]['st_geometrytype']

    # is it a POLYGON or MULTI_POLYGON?
    target_table = ""
    if polygon_type.to_s === "ST_Polygon"
      # it is a POLYGON
      target_table = insert_table
    else
      # it is a MULTI_POLYGON
      target_table = table_name_source

      #
      # at this point the isochrone is not correct in that the "buffer" around the
      # isochrone lines has resulted in a single obect multipolygon ==> meaning a
      # single geometric object that is made up of more than polygon
      #
      # one could combine these multiple polygons into one object, that might be better
      # but it still is geospatially incorrect as far as I know
      #
      # I believe the multipe polygons originates in the line work of the street files (my guess) 
      # where some streets might not be a consecutive line and have a small gap in it
      #
      # at this time I choose not to combine the multipolygon object into a single polygon and 
      # thus will insert it into a table for multipolygons 
      #
      # the results would be the same for the finalencalculation anyway
      #
      result_multicount = conn.query('Select ST_NumGeometries($1)', [geometry])

    end

    db_insert = 'insert into ' + target_table.to_s + ' (geom) Values($1) RETURNING id'
    result_db_insert = conn.query(db_insert,[geometry])

    conn.close

    # inserted row number
    row = result_db_insert.first['id']

    return_hash = { :success          => true,
                    :table_row_number => row,
                    :table_name       => target_table
                  }
 
    return JSON.generate(return_hash)

  end


  def create_isochrone

    latitude_y = params[:latitude].to_f
    longitude_x = params[:longitude].to_f
    time = params[:time].to_i     # in seconds
    db_server_port = params[:db_server_port].to_i

    # determine region of usa using x,y
    region = getRegion(latitude_y, longitude_x)

    if (region)

      # create isochrone using r360
      result_r360 = do_r360_iso(latitude_y, longitude_x, time, region, "user_multi_polygon", db_server_port)
      parsed = JSON.parse(result_r360.to_s)

      if parsed["success"] 

        geometry  = parsed["geometry"]["coordinates"]
        area      = parsed["area"]
        row       = parsed["table_row_number"]

        result_buffer = do_buffer(0.0009, row, "user_multi_polygon", "user_polygon", db_server_port)

        parsed = JSON.parse(result_buffer.to_s)

        if parsed["success"]

          # spatial select to calculate demographics
          row         = parsed["table_row_number"]
          table_name  = parsed["table_name"]


          # ===========================
          #
          # Below was an attempt to see if a speed up of a query could be achieved.
          # It didn't work    
          #
          # ===========================
          # create mbr of buffer geom into temp table
          # puts "session id: " + request.session_options[:id].to_s
          # db_query_mbr = 'select ST_Envelope(geom) as geom into temp_table_mbr from ' + table_name.to_s + ' where ' + table_name.to_s  + '.id = $1;'
          # puts db_query_mbr
    
          # conn = get_conn(db_server_port)
    
          # db_query_drop_table = 'drop table if exists temp_table_mbr;'
          # conn.query(db_query_drop_table)
          # results_db_mbr = conn.query(db_query_mbr, [row])
          # puts results_db_mbr
    
          # db_query_drop_table = 'drop table if exists temp_table_mbr_blocks;'
          # db_query_mbr_blocks = 'select tabblock_2010_pophu.* into temp_table_mbr_blocks from tabblock_2010_pophu, temp_table_mbr where ST_INTERSECTS(temp_table_mbr.geom, tabblock_2010_pophu.geom)' 
          # puts 
          # puts db_query_mbr_blocks
          # puts 
          # conn.query(db_query_drop_table)
          # results_db_mbr_blocks = conn.query(db_query_mbr_blocks)
          # puts results_db_mbr_blocks
          # conn.close


          # db_query = 'select sum(housing10) housing10,' + 
          #              'sum(st_area(st_intersection(' + table_name.to_s + '.geom, temp_table_mbr_blocks.geom))/st_area(temp_table_mbr_blocks.geom) * housing10) as housing_calc, ' +
          #              'sum(pop10) as pop10,' +
          #              'sum(st_area(st_intersection(' + table_name.to_s + '.geom, temp_table_mbr_blocks.geom))/st_area(temp_table_mbr_blocks.geom) * pop10) as pop_calc ' + 
          #              'from tabblock_2010_pophu, ' + table_name.to_s + ' where ' + table_name.to_s + '.id = $1 and ST_INTERSECTS(' + table_name.to_s + '.geom, temp_table_mbr_blocks.geom)'
          # ===========================


          #
          # the following query is by far the slowest part of the calculations
          #
          db_query = 'select sum(housing10) housing10,' + 
                       'sum(st_area(st_intersection(' + table_name.to_s + '.geom, tabblock_2010_pophu.geom))/st_area(tabblock_2010_pophu.geom) * housing10) as housing_calc, ' +
                       'sum(pop10) as pop10,' +
                       'sum(st_area(st_intersection(' + table_name.to_s + '.geom, tabblock_2010_pophu.geom))/st_area(tabblock_2010_pophu.geom) * pop10) as pop_calc ' + 
                       'from tabblock_2010_pophu, ' + table_name.to_s + ' where ' + table_name.to_s + '.id = $1 and ST_INTERSECTS(' + table_name.to_s + '.geom, tabblock_2010_pophu.geom)'

          conn = get_conn(db_server_port)

          Time.now if TRACE
          result_db_query = conn.query(db_query, [row])
          if TRACE
            puts ""
            puts "===> result_db_query (buffer query on blocks): " + (Time.now - start).to_s
            puts ""
          end

          if table_name === "user_polygon"
            db_query_buffer = 'SELECT substring(left(St_astext(geom),-2),10) FROM ' + table_name.to_s + ' where id=$1;'
          else
            db_query_buffer = 'SELECT substring(left(St_astext(geom),-2),16) FROM ' + table_name.to_s + ' where id=$1;'
          end

          Time.now if TRACE
          result_db_query_buffer = conn.query(db_query_buffer, [row])
          if TRACE
            puts
            puts "===> result_db_query_buffer (retrieval of final buffer): " + (Time.now - start).to_s
            puts
          end

          conn.close

          coordinates_string = result_db_query_buffer[0]['substring']
          coordinates_array = coordinates_string.split(",")

          render :json => {
            success: true,
            coordinates: geometry,
            buffer: coordinates_array,
            area: area,
            housing: result_db_query[0]['housing_calc'],
            pop:     result_db_query[0]['pop_calc']
          }
        end

      end
          
    else
      render :json => {
        success: false,
      }
    end
  end
end


